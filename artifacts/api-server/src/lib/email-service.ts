import { logger } from "./logger.js";
import nodemailer from "nodemailer";
import net from "node:net";
import { lookup } from "node:dns/promises";

export interface SmtpConfig {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFrom?: string | null;
}

export interface SendOtpEmailParams {
  toEmail: string;
  recipientName: string;
  otpCode: string;
  expiresInSeconds?: number;
  config?: SmtpConfig;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  mode: "smtp" | "console";
  error?: string;
}

/**
 * Checks if SMTP settings are configured in config or environment variables.
 */
export function isSmtpConfigured(config?: SmtpConfig): boolean {
  if (config?.smtpHost && config?.smtpUser && config?.smtpPass) {
    return true;
  }
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  return Boolean(host && user && pass);
}

/**
 * Resolve a hostname to an IPv4 address.
 *
 * Some hosts (e.g. Railway containers) have an IPv6 interface but no public
 * IPv6 egress, so connecting to a host that resolves to IPv6 (Office 365 does)
 * fails with ENETUNREACH. Nodemailer does its own DNS, so we resolve to IPv4
 * ourselves, connect by the IPv4 literal, and keep `tls.servername` as the real
 * hostname so certificate validation still matches.
 */
async function resolveIpv4(host: string): Promise<string> {
  try {
    const { address } = await lookup(host, { family: 4 });
    return address;
  } catch {
    throw new Error(`SMTP host has no IPv4 address: ${host}`);
  }
}

/**
 * Creates a Nodemailer transporter from config or environment variables,
 * forcing an IPv4 connection. Async because it may resolve DNS.
 */
export async function createTransporter(config?: SmtpConfig) {
  const host = config?.smtpHost || process.env.SMTP_HOST;
  const port = Number(config?.smtpPort || process.env.SMTP_PORT || "587");
  const secure =
    config?.smtpSecure !== undefined
      ? Boolean(config.smtpSecure)
      : process.env.SMTP_SECURE === "true" || port === 465;
  const user =
    config?.smtpUser || process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass =
    config?.smtpPass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  // Connect over IPv4. If the host is already an IP literal, use it as-is;
  // otherwise resolve it to an IPv4 address and verify the cert against the
  // original hostname via SNI.
  const tls: Record<string, unknown> = { rejectUnauthorized: true };
  let connectHost = host || undefined;
  if (host && net.isIP(host) === 0) {
    connectHost = await resolveIpv4(host);
    tls.servername = host;
  }

  return nodemailer.createTransport({
    host: connectHost,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls,
    // Fail fast instead of hanging the request when the mail server is
    // unreachable (e.g. the outbound SMTP port is blocked by the host).
    // Kept well under the web client's 30s abort and any gateway timeout.
    connectionTimeout: 10000, // TCP connect
    greetingTimeout: 10000, // wait for the server banner
    socketTimeout: 15000, // inactivity once connected
  });
}

/** Map a raw SMTP/connection error to a human-readable bilingual reason. */
export function describeSmtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const code = String(e?.code ?? "");
  const resp = e?.responseCode;
  const msg = String(e?.message ?? err ?? "");
  if (code === "EAUTH" || resp === 535 || /\b535\b|authenticat/i.test(msg)) {
    return "فشل تسجيل الدخول لخادم البريد (SMTP) — راجع البيانات، وتأكد إن SMTP AUTH مفعّل للميلبوكس، واستخدم App Password لو فيه MFA / SMTP authentication failed (check credentials, enable SMTP AUTH for the mailbox, use an app password if MFA is on)";
  }
  if (
    /ENETUNREACH|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN|EDNS|timed out/i.test(
      `${code} ${msg}`,
    )
  ) {
    return "تعذّر الوصول لخادم البريد (SMTP) — المنفذ محجوب أو الخادم غير قابل للوصول / Cannot reach SMTP server (port blocked or host unreachable)";
  }
  if (/no IPv4 address/i.test(msg)) {
    return `خادم البريد ليس له عنوان IPv4 / ${msg}`;
  }
  return msg;
}

/**
 * Send an email but never let it block longer than `ms` — a hard ceiling on
 * top of the transporter's own timeouts, so a misbehaving SMTP server can't
 * hang the HTTP request past the client's limit.
 */
export async function sendMailWithTimeout(
  transporter: { sendMail: (msg: any) => Promise<any> },
  message: any,
  ms = 15000,
): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`SMTP send timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([transporter.sendMail(message), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getTransporter(config?: SmtpConfig) {
  return createTransporter(config);
}

/**
 * Send a message, retrying on transient failures (network blips, timeouts,
 * greylisting, 4xx/5xx SMTP). Without this a single hiccup drops that night's
 * daily report entirely. Waits with exponential backoff between attempts.
 *
 * @returns the nodemailer send info on success; throws the last error if every
 *          attempt fails.
 */
export async function sendMailWithRetry(
  transporter: { sendMail: (msg: any) => Promise<any> },
  message: any,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
    label?: string;
  } = {},
): Promise<any> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 15_000;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const label = options.label ?? "email";
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // Each attempt is bounded by its own timeout so a hung connection does
      // not stall the whole retry budget.
      return await sendMailWithTimeout(transporter, message, timeoutMs);
    } catch (err: any) {
      lastErr = err;
      if (attempt < attempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          { err },
          `[email-retry] ${label} send attempt ${attempt}/${attempts} failed; retrying in ${Math.round(delay / 1000)}s`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Generates the bilingual Sunrise branded HTML email template for password reset OTP.
 */
function generateOtpEmailHtml(
  name: string,
  otp: string,
  expiresInSeconds: number,
): string {
  const minutes = Math.ceil(expiresInSeconds / 60);
  const minuteLabel =
    minutes === 1
      ? "دقيقة واحدة"
      : minutes === 2
        ? "دقيقتين"
        : `${minutes} دقائق`;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز التحقق لاستعادة كلمة المرور | SUNRISE Resident</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F2A44 0%, #1e3a5f 100%); padding: 36px 30px; text-align: center;">
              <div style="font-size: 28px; font-weight: 800; color: #C9A24D; letter-spacing: 1px; margin-bottom: 6px;">
                SUNRISE
              </div>
              <div style="font-size: 14px; font-weight: 500; color: #e2e8f0; letter-spacing: 0.5px;">
                Resorts & Cruises &bull; SUNRISE Resident
              </div>
              <div style="margin-top: 12px; display: inline-block; padding: 4px 14px; background-color: rgba(201, 162, 77, 0.15); border: 1px solid rgba(201, 162, 77, 0.3); border-radius: 20px; font-size: 12px; color: #fef08a;">
                إدارة السكن الفندقي والعاملين
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px; text-align: right; direction: rtl;">
              <h2 style="font-size: 20px; font-weight: 700; color: #0F2A44; margin: 0 0 16px 0;">
                مرحباً ${escapeHtml(name)} 👋
              </h2>
              <p style="font-size: 15px; line-height: 1.7; color: #475569; margin: 0 0 24px 0;">
                لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong>SUNRISE Resident</strong>.
                استخدم رمز التحقق (OTP) التالي لتأكيد هويتك ومتابعة العملية:
              </p>

              <!-- OTP Box -->
              <div style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 2px dashed #C9A24D; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
                <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                  رمز التحقق الخاص بك / YOUR VERIFICATION CODE
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; color: #0F2A44; letter-spacing: 10px; padding: 8px 0; user-select: all;">
                  ${otp}
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #dc2626; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  ⏱️ صالح لمدة ${minuteLabel} (${expiresInSeconds} ثانية) فقط
                </div>
              </div>

              <!-- English Mirror -->
              <div style="direction: ltr; text-align: left; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0;">
                  We received a password reset request for your SUNRISE Resident account.
                  Please enter the 6-digit code above to reset your password. This code will expire in <strong>${minutes} minutes (${expiresInSeconds} seconds)</strong>.
                </p>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef2f2; border-right: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin: 26px 0 0 0; text-align: right; direction: rtl;">
                <div style="font-size: 13px; font-weight: 700; color: #991b1b; margin-bottom: 4px;">
                  ⚠️ تنبيه أمني هام
                </div>
                <div style="font-size: 12px; line-height: 1.6; color: #b91c1c;">
                  إذا لم تقم بطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة أو التواصل مع مسؤول النظام وأمن تقنية المعلومات فوراً. لا تشارك هذا الرمز مع أي شخص.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 30px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
              <div>&copy; ${new Date().getFullYear()} Sunrise Resorts & Cruises. All rights reserved.</div>
              <div style="margin-top: 4px;">SUNRISE Resident &bull; Secure Authentication Module</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sends the OTP reset email to the recipient.
 * Falls back to console output if SMTP is not configured or fails in development.
 */
export async function sendOtpEmail({
  toEmail,
  recipientName,
  otpCode,
  expiresInSeconds = 180,
  config,
}: SendOtpEmailParams): Promise<SendEmailResult> {
  const isConfigured = isSmtpConfigured(config);
  const minutes = Math.ceil(expiresInSeconds / 60);
  const minuteLabel =
    minutes === 1
      ? "دقيقة واحدة"
      : minutes === 2
        ? "دقيقتين"
        : `${minutes} دقائق`;

  if (!isConfigured) {
    logger.info("\n" + "=".repeat(65));
    logger.info(
      "📨 [AUTH OTP SIMULATION] (SMTP not configured in environment or settings)",
    );
    logger.info(`👤 Recipient : ${recipientName} <${toEmail}>`);
    logger.info(`🔑 OTP Code  : >>> ${otpCode} <<<`);
    logger.info(
      `⏱️ Validity  : ${expiresInSeconds} seconds (${minutes} minutes)`,
    );
    logger.info("=".repeat(65) + "\n");
    return { success: true, mode: "console" };
  }

  try {
    const transporter = await getTransporter(config);
    const fromAddress =
      config?.smtpFrom ||
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      `"SUNRISE Resident" <${config?.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `رمز التحقق لاستعادة كلمة المرور: ${otpCode} | SUNRISE Resident`,
      html: generateOtpEmailHtml(recipientName, otpCode, expiresInSeconds),
      text: `مرحباً ${recipientName}،\nرمز التحقق لاستعادة كلمة المرور الخاص بك في SUNRISE Resident هو: ${otpCode}\nهذا الرمز صالح لمدة ${minuteLabel} (${expiresInSeconds} ثانية) فقط.\nإذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.`,
    });

    logger.info(
      `[AUTH OTP] Email sent successfully to ${toEmail}. Message ID: ${info.messageId}`,
    );
    return { success: true, messageId: info.messageId, mode: "smtp" };
  } catch (err: any) {
    logger.error(
      { err },
      `[AUTH OTP ERROR] Failed to send email via SMTP to ${toEmail}`,
    );
    logger.info("\n" + "=".repeat(65));
    logger.info(
      "⚠️ [AUTH OTP FALLBACK] (Failed to send via SMTP, code logged for recovery)",
    );
    logger.info(`👤 Recipient : ${recipientName} <${toEmail}>`);
    logger.info(`🔑 OTP Code  : >>> ${otpCode} <<<`);
    logger.info("=".repeat(65) + "\n");
    return { success: true, mode: "console", error: err?.message };
  }
}

/**
 * Sends a test email to verify SMTP configuration live.
 */
export async function sendTestEmail({
  toEmail,
  config,
}: {
  toEmail: string;
  config?: SmtpConfig;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = await getTransporter(config);
    // Verify connection first
    await transporter.verify();

    const fromAddress =
      config?.smtpFrom ||
      process.env.SMTP_FROM ||
      `"SUNRISE Resident" <${config?.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: "اختبار إعدادات البريد الإلكتروني | SUNRISE Resident",
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #0F2A44 0%, #1e3a5f 100%); padding: 24px; text-align: center; border-radius: 8px; color: #C9A24D;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px;">SUNRISE</h1>
            <p style="margin: 6px 0 0; color: #e2e8f0; font-size: 13px;">Resorts & Cruises &bull; SUNRISE Resident</p>
          </div>
          <div style="padding: 24px 8px;">
            <h2 style="color: #0F2A44; margin-top: 0; font-size: 19px;">تهانينا! إعدادات البريد الإلكتروني تعمل بنجاح 🎉</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.7;">
              تم إرسال هذه الرسالة التجريبية بنجاح لتأكيد صحة اتصال سيرفر البريد الإلكتروني (SMTP) بنظام SUNRISE Resident.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; color: #334155;">
              <div style="margin-bottom: 8px;"><strong>سيرفر البريد (Host):</strong> ${escapeHtml(config?.smtpHost || process.env.SMTP_HOST || "Default")}</div>
              <div style="margin-bottom: 8px;"><strong>المنفذ (Port):</strong> ${config?.smtpPort || process.env.SMTP_PORT || "587"}</div>
              <div style="margin-bottom: 8px;"><strong>حساب الإرسال (User):</strong> ${escapeHtml(config?.smtpUser || process.env.SMTP_USER || "Default")}</div>
              <div><strong>تاريخ وتوقيت الاختبار:</strong> ${new Date().toLocaleString("ar-EG")}</div>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
              الآن يمكن للنظام إرسال رموز التحقق (OTP) لاستعادة كلمات المرور والإشعارات التلقائية بأمان.
            </p>
          </div>
          <div style="text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px;">
            &copy; ${new Date().getFullYear()} Sunrise Resorts & Cruises. All rights reserved.
          </div>
        </div>
      `,
      text: `تهانينا! إعدادات البريد الإلكتروني تعمل بنجاح في نظام SUNRISE Resident.\nالسيرفر: ${config?.smtpHost || process.env.SMTP_HOST || "Default"}\nالمنفذ: ${config?.smtpPort || process.env.SMTP_PORT || "587"}\nتاريخ الاختبار: ${new Date().toLocaleString("ar-EG")}`,
    });

    logger.info(
      `[SMTP TEST] Test email sent successfully to ${toEmail}. Message ID: ${info.messageId}`,
    );
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    logger.error(
      { err },
      `[SMTP TEST ERROR] Failed to send test email to ${toEmail}`,
    );
    return { success: false, error: describeSmtpError(err) };
  }
}
