// メール配信基盤（Resend）。RESEND_API_KEY が未設定の環境（ローカル/テスト）では
// 送信をスキップし、コンソールに出力するだけのフォールバックにする。
const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailParams {
  to: string
  subject: string
  text: string
}

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'RESON <no-reply@reson.example>'

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY未設定のため送信をスキップしました: to=${params.to} subject=${params.subject}`)
    return { sent: false }
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    }),
  })

  if (!res.ok) {
    console.error(`[email] 送信に失敗しました: ${res.status} ${await res.text()}`)
    return { sent: false }
  }

  return { sent: true }
}
