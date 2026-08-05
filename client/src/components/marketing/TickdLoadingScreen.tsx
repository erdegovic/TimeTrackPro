import tickdLogoFull from "@/assets/tickd-logo-full.svg";
import tickdLogoMark from "@/assets/tickd-logo-mark.svg";

export default function TickdLoadingScreen() {
  return (
    <div className="tickd-auth-loader" role="status" aria-live="polite" aria-label="Opening Tickd">
      <div className="tickd-auth-loader__lockup">
        <div className="tickd-auth-loader__clock" aria-hidden="true">
          <img src={tickdLogoMark} alt="" />
          <span className="tickd-auth-loader__face">
            <span className="tickd-auth-loader__hand tickd-auth-loader__hand--short" />
            <span className="tickd-auth-loader__hand tickd-auth-loader__hand--long" />
            <span className="tickd-auth-loader__pin" />
          </span>
        </div>
        <img src={tickdLogoFull} alt="Tickd" className="tickd-auth-loader__wordmark" />
      </div>
    </div>
  );
}
