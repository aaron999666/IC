import { Link } from 'react-router-dom'
import { BILLING_PORTAL_URL } from '../lib/billing'

type RechargePromptModalProps = {
  open: boolean
  title: string
  body: string
  companyName: string | null
  onClose: () => void
}

function RechargePromptModal({
  open,
  title,
  body,
  companyName,
  onClose,
}: RechargePromptModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recharge-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Points</p>
        <h2 id="recharge-modal-title">{title}</h2>
        <p className="section-copy">{body}</p>
        <div className="stack-block compact-stack">
          <strong>{companyName ?? 'Current company context missing'}</strong>
          <span>
            充值、支付回调和法币对账可以走国内备案服务器，主站继续保持纯信息流与积分控制。
          </span>
        </div>
        <div className="form-toolbar">
          <a
            className="primary-action inline-link-button"
            href={BILLING_PORTAL_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open pay.iccorehub.com
          </a>
          <Link className="secondary-action inline-link-button" to="/recharge">
            Open recharge center
          </Link>
          <button type="button" className="ghost-link" onClick={onClose}>
            Continue browsing
          </button>
        </div>
      </section>
    </div>
  )
}

export default RechargePromptModal
