"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

/* Sources Button's `pending` flag from the enclosing form's submission status.

   Why this component exists at all: both Phase 1 buttons submit a form bound to a
   server action, so there is no client-side handler to flip a piece of state — the
   button cannot know on its own that a submission is in flight. useFormStatus reports
   it, but only from a client component that is a CHILD of the form element — never
   from the component that renders that form, nor from anything above it. Rendered in
   the wrong place it silently returns a permanently-false pending value: the button
   looks correct in review and fails only when a user taps it on a slow connection,
   which is exactly when the feedback mattered.

   So: render this inside the form element, and never let it render that form itself.

   The client boundary is kept this small on purpose. Making a page or the layout a
   client component to get a pending state would pull the session-rendering path into
   the client and undermine the static shell the phase is built around. */
export function SubmitButton(props: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button type="submit" pending={pending} {...props} />;
}
