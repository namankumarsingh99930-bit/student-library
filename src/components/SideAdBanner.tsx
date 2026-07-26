import React, { useEffect, useRef } from 'react';

export default function SideAdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = `
      (function(sucke){
      var d = document,
          s = d.createElement('script'),
          l = d.scripts[d.scripts.length - 1];
      s.settings = sucke || {};
      s.src = "//unfoldedtrade.com/bSX.V/skd/Gjli0/YEWFcL/qefmB9su/ZUU-lakZPhTlc-yINcT/gn2ROYD/E/tPNEzCIR1ZO/DRYH4ANnQE";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
    `;
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div className="w-full flex justify-center items-start">
      <div ref={containerRef} />
    </div>
  );
}
