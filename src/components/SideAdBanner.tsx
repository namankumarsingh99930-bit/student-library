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
      s.src = "//relieved-understanding.com/bbXDV.s/dJG/ln0YYrWscs/KeamT9WuxZzUfl/k/P/TicByZNeT/UI0NNlTUMOtzNfzEIC1qNzT/Q/1ANkw_";
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
