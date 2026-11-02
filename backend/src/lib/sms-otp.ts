// Delivers phone-verification OTP codes over SMS via a third-party gateway,
// selected by OTP_PROVIDER. Returns true only when the provider accepted it.
// Never throws — callers decide what to do on a false result.
import { env } from "../env.js";
import { logger } from "../logger.js";

/** Split an Indian phone into its E.164 form and bare 10-digit local form. */
function normalizePhone(phone: string): { e164: string; local10: string } {
  const digits = phone.replace(/\D/g, "");
  const local10 = digits.slice(-10);
  const e164 = phone.trim().startsWith("+") ? `+${digits}` : `+91${local10}`;
  return { e164, local10 };
}

async function sendFast2Sms(code: string, local10: string): Promise<boolean> {
  if (!env.FAST2SMS_API_KEY) return false;
  // Quick SMS route (route=q): custom message from a numeric sender, no merchant
  // DLT. (The dedicated OTP route needs website/DLT verification on Fast2SMS.)
  const message = `${code} is your Aloravie verification code. Valid ${env.OTP_TTL_MINUTES} min. Do not share it.`;
  const params = new URLSearchParams({
    authorization: env.FAST2SMS_API_KEY,
    route: "q",
    message,
    language: "english",
    flash: "0",
    numbers: local10,
  });
  const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`);
  const data = (await res.json().catch(() => ({}))) as { return?: boolean };
  const ok = res.ok && data.return === true;
  if (!ok) logger.error({ status: res.status, data }, "fast2sms quick-sms send failed");
  return ok;
}

async function sendMsg91(code: string, local10: string): Promise<boolean> {
  if (!env.MSG91_AUTH_KEY || !env.MSG91_OTP_TEMPLATE_ID) return false;
  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: { authkey: env.MSG91_AUTH_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: env.MSG91_OTP_TEMPLATE_ID,
      mobile: `91${local10}`,
      otp: code,
      ...(env.MSG91_SENDER ? { sender: env.MSG91_SENDER } : {}),
    }),
  });
  if (!res.ok) logger.error({ status: res.status }, "msg91 otp send failed");
  return res.ok;
}

async function sendTwilio(code: string, e164: string): Promise<boolean> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_SMS_FROM) return false;
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = `${code} is your Aloravie verification code. It expires in ${env.OTP_TTL_MINUTES} minutes. Do not share it.`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: env.TWILIO_SMS_FROM, To: e164, Body: body }).toString(),
  });
  if (!res.ok) logger.error({ status: res.status }, "twilio otp send failed");
  return res.ok;
}

/** Send the OTP via the configured provider. Returns whether it was accepted. */
export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  const { e164, local10 } = normalizePhone(phone);
  try {
    switch (env.OTP_PROVIDER) {
      case "fast2sms":
        return await sendFast2Sms(code, local10);
      case "msg91":
        return await sendMsg91(code, local10);
      case "twilio":
        return await sendTwilio(code, e164);
      default:
        return false;
    }
  } catch (err) {
    logger.error({ err, provider: env.OTP_PROVIDER }, "otp sms send threw");
    return false;
  }
}
