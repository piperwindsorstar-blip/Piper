import { ButtonOutline, ButtonPrimary } from './ui.tsx'

export function StickyBookBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper/95 px-4 pt-3 backdrop-blur-md"
      style={{
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="hidden text-sm text-soft sm:block">
          <span className="font-semibold text-ink">Dates are booking up.</span>{' '}
          Reply within one business day.
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <ButtonOutline className="flex-1 !px-5 !py-2.5 text-sm sm:flex-none">
            Explore Packages
          </ButtonOutline>
          <ButtonPrimary className="flex-1 !px-5 !py-2.5 text-sm sm:flex-none">
            Check Dates
          </ButtonPrimary>
        </div>
      </div>
    </div>
  )
}
