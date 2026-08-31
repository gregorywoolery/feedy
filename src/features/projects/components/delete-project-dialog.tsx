"use client"

import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { forgetProject } from "@/features/app-shell/components/recent-projects"

export function DeleteProjectDialog({
  projectId,
  projectName,
  feedbackCount,
  trigger,
}: {
  projectId: string
  projectName: string
  feedbackCount: number
  trigger: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")

  async function deleteProject() {
    if (isDeleting) return
    setIsDeleting(true)
    setError("")

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message || "The project could not be deleted. Try again.")
      }

      forgetProject(projectId)
      setOpen(false)
      toast.success(`${projectName} deleted.`)
      router.push("/projects")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The project could not be deleted. Try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {projectName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the project, its {feedbackCount} feedback {feedbackCount === 1 ? "item" : "items"}, and every attached photo. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault()
              void deleteProject()
            }}
          >
            {isDeleting ? (
              <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
            ) : (
              <Trash2 aria-hidden="true" data-icon="inline-start" />
            )}
            {isDeleting ? "Deleting…" : "Delete project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
