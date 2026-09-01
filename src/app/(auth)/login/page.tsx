import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

/* ───────────────────────────── IMAGE SLOTS ─────────────────────────────
 * Drop your image files into the project's `public/` folder, then set the
 * two paths below.
 *
 * These are PUBLIC WEB PATHS (they start with "/"), NOT Windows folder
 * paths. Next.js serves anything inside `public/` from the site root:
 *
 *     file on disk:  c:\Users\sumee\github\LogiPortal\public\login-hero.jpg
 *     value here:    "/login-hero.jpg"
 *
 *     file on disk:  c:\Users\sumee\github\LogiPortal\public\brand\logo.svg
 *     value here:    "/brand/logo.svg"
 *
 * Leave a value as "" (empty string) to show the built-in placeholder for
 * that slot instead.
 * -------------------------------------------------------------------- */
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1606185540834-d6e7483ee1a4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"; // large image filling the right half of the screen
const LOGO_IMAGE = "/brand/sw_black.png"; // your brand logo, shown top-left above the form
/* -------------------------------------------------------------------- */

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left column — brand mark + login form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <span className="flex items-center gap-2 font-medium text-text-primary">
            {LOGO_IMAGE ? (
              // sw_white.png is a 1920x1080 canvas with wide built-in
              // whitespace around the mark; w-48 renders it at a sensible
              // header size. Swap in a trimmed export / SVG for a tighter fit.
              <Image
                src={LOGO_IMAGE}
                alt="Seawave"
                width={480}
                height={270}
                priority
                className="h-auto w-48"
              />
            ) : (
              <>
                {/* Placeholder mark — auto-hides once LOGO_IMAGE is set above */}
                <span className="flex size-8 items-center justify-center rounded-md bg-brand-teal text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <path d="M2 20a5 5 0 0 0 8 0 5 5 0 0 1 8 0 5 5 0 0 0 4 0" />
                    <path d="M2 13a5 5 0 0 0 8 0 5 5 0 0 1 8 0 5 5 0 0 0 4 0" />
                  </svg>
                </span>
                <span>Seawave</span>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right column — hero image, hidden below the lg breakpoint */}
      <div className="relative hidden bg-border-subtle lg:block">
        {HERO_IMAGE ? (
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 0px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-brand-teal via-brand-teal to-brand-plum" />
        )}
      </div>
    </div>
  );
}
