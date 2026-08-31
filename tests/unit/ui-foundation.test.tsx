import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MobileNav } from "@/features/app-shell/components/mobile-nav"
import { NavigationLinks } from "@/features/app-shell/components/navigation"

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/example-project",
}))

describe("UI foundation", () => {
  it("marks the current shell destination for assistive technology", () => {
    render(<NavigationLinks />)

    expect(
      screen.getByRole("link", { name: "Projects" }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: "Feedback" }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("gives a form sheet an accessible title and stable regions", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add feedback</SheetTitle>
          </SheetHeader>
          <SheetBody>Form fields</SheetBody>
          <SheetFooter>Form actions</SheetFooter>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByRole("dialog", { name: "Add feedback" })).toBeTruthy()
    expect(screen.getByText("Form fields")).toBeTruthy()
    expect(screen.getByText("Form actions")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Close panel" })).toBeTruthy()
  })

  it("opens and closes the mobile navigation through keyboard-sized controls", async () => {
    const user = userEvent.setup()
    render(<MobileNav />)

    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(
      screen.getByRole("dialog", { name: "Workspace navigation" })
    ).toBeTruthy()

    await user.click(screen.getByRole("link", { name: "Feedback" }))
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Workspace navigation" })
      ).toBeNull()
    })
  })
})
