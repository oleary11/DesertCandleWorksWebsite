"use client";

import { useState } from "react";
import { Share2, Facebook, Link as LinkIcon, Check } from "lucide-react";

type ShareButtonsProps = {
  productName: string;
  productSlug: string;
};

export default function ShareButtons({ productName, productSlug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const productUrl = `${baseUrl}/shop/${productSlug}`;
  const shareText = `Check out ${productName} from Desert Candle Works!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowDropdown(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(facebookUrl, "_blank", "width=600,height=400");
    setShowDropdown(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: shareText,
          url: productUrl,
        });
        setShowDropdown(false);
      } catch (error) {
        // User cancelled or error occurred
        console.log("Share cancelled:", error);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          // If native share is available on mobile, use it directly
          if (typeof navigator !== 'undefined' && 'share' in navigator && window.innerWidth < 768) {
            handleNativeShare();
          } else {
            setShowDropdown(!showDropdown);
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--color-line)] hover:bg-neutral-50 transition"
        aria-label="Share product"
      >
        <Share2 className="w-4 h-4" />
        <span>Share</span>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[var(--color-line)] z-20 overflow-hidden">
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-neutral-50 transition text-left"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Link copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  <span>Copy link</span>
                </>
              )}
            </button>

            <button
              onClick={handleFacebookShare}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-neutral-50 transition text-left border-t border-[var(--color-line)]"
            >
              <Facebook className="w-4 h-4 text-blue-600" />
              <span>Share on Facebook</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-neutral-50 transition text-left border-t border-[var(--color-line)]"
              >
                <Share2 className="w-4 h-4" />
                <span>More options...</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
