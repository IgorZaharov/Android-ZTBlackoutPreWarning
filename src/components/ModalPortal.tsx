import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders full-screen dialogs (address picker, queue help, reset confirmation) into the phone screen's
 * modal root so they sit above the floating navigation dock, like a Compose Dialog does on Android.
 * Without a phone (or in tests) they render in place.
 */
export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const target = typeof document !== 'undefined' ? document.querySelector('[data-phone-modal-root]') : null;
  return target ? createPortal(children, target) : <>{children}</>;
};
