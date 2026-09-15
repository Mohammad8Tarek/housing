import nodemailer from "nodemailer";

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
 * Creates a Nodemailer transporter from config or environment variables.
 */
export function createTransporter(config?: SmtpConfig) {
  const host = config?.smtpHost || process.env.SMTP_HOST;
  const port = Number(config?.smtpPort || process.env.SMTP_PORT || "587");
  const secure =
    config?.smtpSecure !== undefined
      ? Boolean(config.smtpSecure)
      : process.env.SMTP_SECURE === "true" || port === 465;
  const user = config?.smtpUser || process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = config?.smtpPass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host: host || undefined,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function getTransporter(config?: SmtpConfig) {
  return createTransporter(config);
}

/**
 * Generates the bilingual Sunrise branded HTML email template for password reset OTP.
 */
function generateOtpEmailHtml(name: string, otp: string, expiresInSeconds: number): string {
  const minutes = Math.ceil(expiresInSeconds / 60);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز التحقق لاستعادة كلمة المرور | Sunrise Staff Housing</title>
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
                Resorts & Cruises &bull; Staff Housing Management
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
                لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong>نظام إدارة سكن العاملين (Sunrise Staff Housing)</strong>.
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
                  ⏱️ صالح لمدة ${minutes} دقيقة (${expiresInSeconds} ثانية) فقط
                </div>
              </div>

              <!-- English Mirror -->
              <div style="direction: ltr; text-align: left; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0;">
                  We received a password reset request for your Sunrise Staff Housing account.
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
              <div style="margin-top: 4px;">Sunrise Staff Housing Management System &bull; Secure Authentication Module</div>
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
  expiresInSeconds = 120,
  config,
}: SendOtpEmailParams): Promise<SendEmailResult> {
  const isConfigured = isSmtpConfigured(config);

  if (!isConfigured) {
    console.log("\n" + "=".repeat(65));
    console.log("📨 [AUTH OTP SIMULATION] (SMTP not configured in environment or settings)");
    console.log(`👤 Recipient : ${recipientName} <${toEmail}>`);
    console.log(`🔑 OTP Code  : >>> ${otpCode} <<<`);
    console.log(`⏱️ Validity  : ${expiresInSeconds} seconds (${Math.ceil(expiresInSeconds / 60)} minutes)`);
    console.log("=".repeat(65) + "\n");
    return { success: true, mode: "console" };
  }

  try {
    const transporter = getTransporter(config);
    const fromAddress =
      config?.smtpFrom ||
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      `"Sunrise Staff Housing" <${config?.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `رمز التحقق لاستعادة كلمة المرور: ${otpCode} | Sunrise Staff Housing`,
      html: generateOtpEmailHtml(recipientName, otpCode, expiresInSeconds),
      text: `مرحباً ${recipientName}،\nرمز التحقق لاستعادة كلمة المرور الخاص بك في Sunrise Staff Housing هو: ${otpCode}\nهذا الرمز صالح لمدة ${Math.ceil(expiresInSeconds / 60)} دقيقة (${expiresInSeconds} ثانية) فقط.\nإذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.`,
    });

    console.log(`[AUTH OTP] Email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId, mode: "smtp" };
  } catch (err: any) {
    console.error(`[AUTH OTP ERROR] Failed to send email via SMTP to ${toEmail}:`, err?.message || err);
    console.log("\n" + "=".repeat(65));
    console.log("⚠️ [AUTH OTP FALLBACK] (Failed to send via SMTP, code logged for recovery)");
    console.log(`👤 Recipient : ${recipientName} <${toEmail}>`);
    console.log(`🔑 OTP Code  : >>> ${otpCode} <<<`);
    console.log("=".repeat(65) + "\n");
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
    const transporter = getTransporter(config);
    // Verify connection first
    await transporter.verify();

    const fromAddress =
      config?.smtpFrom ||
      process.env.SMTP_FROM ||
      `"Sunrise Staff Housing" <${config?.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: "اختبار إعدادات البريد الإلكتروني | Sunrise Staff Housing",
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #0F2A44 0%, #1e3a5f 100%); padding: 24px; text-align: center; border-radius: 8px; color: #C9A24D;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px;">SUNRISE</h1>
            <p style="margin: 6px 0 0; color: #e2e8f0; font-size: 13px;">Resorts & Cruises &bull; Staff Housing Management</p>
          </div>
          <div style="padding: 24px 8px;">
            <h2 style="color: #0F2A44; margin-top: 0; font-size: 19px;">تهانينا! إعدادات البريد الإلكتروني تعمل بنجاح 🎉</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.7;">
              تم إرسال هذه الرسالة التجريبية بنجاح لتأكيد صحة اتصال سيرفر البريد الإلكتروني (SMTP) بنظام إدارة سكن العاملين (Sunrise Staff Housing).
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; color: #334155;">
              <div style="margin-bottom: 8px;"><strong>سيرفر البريد (Host):</strong> ${escapeHtml(config?.smtpHost || process.env.SMTP_HOST || 'Default')}</div>
              <div style="margin-bottom: 8px;"><strong>المنفذ (Port):</strong> ${config?.smtpPort || process.env.SMTP_PORT || '587'}</div>
              <div style="margin-bottom: 8px;"><strong>حساب الإرسال (User):</strong> ${escapeHtml(config?.smtpUser || process.env.SMTP_USER || 'Default')}</div>
              <div><strong>تاريخ وتوقيت الاختبار:</strong> ${new Date().toLocaleString('ar-EG')}</div>
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
      text: `تهانينا! إعدادات البريد الإلكتروني تعمل بنجاح في نظام Sunrise Staff Housing.\nالسيرفر: ${config?.smtpHost || process.env.SMTP_HOST || 'Default'}\nالمنفذ: ${config?.smtpPort || process.env.SMTP_PORT || '587'}\nتاريخ الاختبار: ${new Date().toLocaleString('ar-EG')}`,
    });

    console.log(`[SMTP TEST] Test email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[SMTP TEST ERROR] Failed to send test email to ${toEmail}:`, err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}
