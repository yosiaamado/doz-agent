import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { getStatus, subscribeStatus } from '../../lib/events.js';

const DELAY_MS = 1000;

export default function ReconnectBanner() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer = null;
    const apply = (status) => {
      clearTimeout(timer);
      if (status === 'reconnecting') timer = setTimeout(() => setShow(true), DELAY_MS);
      else setShow(false);
    };
    apply(getStatus());
    const off = subscribeStatus(apply);
    return () => { clearTimeout(timer); off(); };
  }, []);

  return (
    <div className="reconnect" role="status" aria-live="polite">
      {show && <div className="reconnect-pill"><WifiOff size={14} aria-hidden="true" /> {t('reconnecting')}</div>}
    </div>
  );
}
