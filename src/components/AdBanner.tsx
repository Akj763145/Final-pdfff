import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  slot?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
}

export function AdBanner({ slot, format = 'auto', responsive = true, className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const isLoaded = useRef(false);
  const clientId = (import.meta as any).env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-6157215002118614';
  const adSlot = slot || (import.meta as any).env.VITE_ADSENSE_SLOT_ID;

  useEffect(() => {
    if (!clientId || !adRef.current || isLoaded.current) return;

    let animationFrameId: number;

    const pushAd = () => {
      if (adRef.current && adRef.current.offsetWidth > 0) {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          isLoaded.current = true;
        } catch (error) {
          console.error('AdSense error:', error);
        }
      } else {
        // Wait for next frame if width is still 0
        animationFrameId = requestAnimationFrame(pushAd);
      }
    };

    // Start checking
    animationFrameId = requestAnimationFrame(pushAd);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <div className={`bg-zinc-100 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm p-6 min-h-[100px] ${className}`}>
        <span className="font-semibold mb-1">Advertisement Placeholder</span>
        <span className="text-xs">Configure VITE_ADSENSE_CLIENT_ID to show real ads</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden flex justify-center w-full min-h-[100px] min-w-[200px] ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minWidth: '200px' }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
