/* Loading placeholder. The animation, its 150ms delay, the zero starting opacity and
   the forwards fill mode all live in the `.skeleton` class in globals.css, so content
   that arrives in under ~150ms never flashes a placeholder — a skeleton that appears
   and vanishes inside a frame or two reads as a glitch rather than as loading.

   SIZING CONTRACT — this is the part callers get wrong.
   Size the skeleton in `em`, inside a wrapper carrying the type token of the text it
   stands in for. Never use a fixed `h-*` utility.

     <div className="text-display">
       <Skeleton className="h-[1.3em] w-48" />
     </div>

   A display-sized line of text is 2rem x 1.3 = 41.6px tall. That is not a multiple of
   4, so no spacing-scale utility can express it: `h-10` is 1.6px short and `h-11` is
   2.4px over, and either one guarantees the layout jump the skeleton exists to prevent.
   `1.3em` resolves against the wrapper's own font-size, so the box is exact — and stays
   exact on its own if the display token or its line-height is ever retuned.

   Width is a deliberate placeholder estimate, not a match: no width can match text of
   unknown length. Horizontal shift on arrival is accepted and harmless for left-aligned
   text — only the right edge moves and nothing around it is displaced. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
