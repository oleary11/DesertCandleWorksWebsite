"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/* ---------- Types ---------- */
type ModalButton = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
};

type ModalConfig = {
  title?: string;
  message: string;
  buttons: ModalButton[];
  onClose?: () => void;
};

type ModalContextType = {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showPrompt: (message: string, title?: string, defaultValue?: string) => Promise<string | null>;
  showModal: (config: Omit<ModalConfig, "buttons"> & { buttons?: ModalButton[] }) => void;
  closeModal: () => void;
};

/* ---------- Context ---------- */
const ModalContext = createContext<ModalContextType | null>(null);

/* ---------- Provider ---------- */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);
  const [promptConfig, setPromptConfig] = useState<{ message: string; title: string; defaultValue: string } | null>(null);
  const [promptResolve, setPromptResolve] = useState<((value: string | null) => void) | null>(null);

  const closeModal = () => {
    setModalConfig(null);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  };

  const showAlert = (message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setModalConfig({
        title: title || "Notice",
        message,
        buttons: [
          {
            label: "OK",
            variant: "primary",
            onClick: () => {
              closeModal();
              resolve();
            },
          },
        ],
      });
    });
  };

  const showConfirm = (message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
      setModalConfig({
        title: title || "Confirm",
        message,
        buttons: [
          {
            label: "Cancel",
            variant: "secondary",
            onClick: () => {
              setModalConfig(null);
              resolve(false);
              setResolvePromise(null);
            },
          },
          {
            label: "OK",
            variant: "primary",
            onClick: () => {
              setModalConfig(null);
              resolve(true);
              setResolvePromise(null);
            },
          },
        ],
      });
    });
  };

  const showPrompt = (message: string, title?: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptResolve(() => resolve);
      setPromptConfig({
        message,
        title: title || "Enter Value",
        defaultValue: defaultValue || "",
      });
    });
  };

  const showModal = (config: Omit<ModalConfig, "buttons"> & { buttons?: ModalButton[] }) => {
    setModalConfig({
      title: config.title,
      message: config.message,
      buttons: config.buttons || [
        {
          label: "OK",
          variant: "primary",
          onClick: () => {
            closeModal();
            config.onClose?.();
          },
        },
      ],
      onClose: config.onClose,
    });
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, showModal, closeModal }}>
      {children}
      {modalConfig && <ModalDialog config={modalConfig} onBackdropClick={closeModal} />}
      {promptConfig && (
        <PromptDialog
          config={promptConfig}
          onCancel={() => {
            setPromptConfig(null);
            promptResolve?.(null);
            setPromptResolve(null);
          }}
          onSubmit={(value) => {
            setPromptConfig(null);
            promptResolve?.(value);
            setPromptResolve(null);
          }}
        />
      )}
    </ModalContext.Provider>
  );
}

/* ---------- Hook ---------- */
export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

/* ---------- Modal Dialog Component ---------- */
function ModalDialog({ config, onBackdropClick }: { config: ModalConfig; onBackdropClick: () => void }) {
  const getButtonClass = (variant?: string) => {
    switch (variant) {
      case "primary":
        return "btn btn-primary";
      case "danger":
        return "btn bg-rose-600 text-white hover:bg-rose-700";
      default:
        return "btn";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onBackdropClick} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        {config.title && (
          <div className="px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white rounded-t-2xl">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">{config.title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[var(--color-ink)] whitespace-pre-wrap">{config.message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl">
          {config.buttons.map((button, idx) => (
            <button key={idx} className={getButtonClass(button.variant)} onClick={button.onClick}>
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Prompt Dialog Component ---------- */
function PromptDialog({
  config,
  onCancel,
  onSubmit,
}: {
  config: { message: string; title: string; defaultValue: string };
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(config.defaultValue);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">{config.title}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-[var(--color-ink)]">{config.message}</p>
          <input
            type="text"
            className="input w-full"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSubmit(value);
              } else if (e.key === "Escape") {
                onCancel();
              }
            }}
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onSubmit(value)}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
