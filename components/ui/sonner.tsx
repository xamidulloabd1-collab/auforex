"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-border !bg-popover !text-foreground !font-sans",
          description: "!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
