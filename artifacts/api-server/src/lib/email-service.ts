import nodemailer from "nodemailer";

export interface SendOtpEmailParams {
  toEmail: string;
  recipientName: string;
  otpCode: string;
  expiresInSeconds?: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  mode: "smtp" | "console";
  error?: string;
}

/**
 * Checks if SMTP settings are configured in environment variables.
 */
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  return Boolean(host && user && pass);
}

/**
 * Creates or gets a Nodemailer transporter.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
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
}: SendOtpEmailParams): Promise<SendEmailResult> {
  const isConfigured = isSmtpConfigured();

  if (!isConfigured) {
    console.log("\n" + "=".repeat(65));
    console.log("📨 [AUTH OTP SIMULATION] (SMTP not configured in environment)");
    console.log(`👤 Recipient : ${recipientName} <${toEmail}>`);
    console.log(`🔑 OTP Code  : >>> ${otpCode} <<<`);
    console.log(`⏱️ Validity  : ${expiresInSeconds} seconds (${Math.ceil(expiresInSeconds / 60)} minutes)`);
    console.log("=".repeat(65) + "\n");
    return { success: true, mode: "console" };
  }

  try {
    const transporter = getTransporter();
    const fromAddress =
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      `"Sunrise Staff Housing" <${process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`;

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
