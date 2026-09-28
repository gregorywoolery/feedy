"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ApiErrorBody } from "@/entities/contracts/api";
import type { ProjectRecord } from "@/entities/contracts/project";

type Stage = "form" | "review" | "success";

export function ProjectSheet({ trigger }: { trigger: ReactNode }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<ProjectRecord | null>(null);

  useEffect(() => {
    if (open && stage === "form")
      window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, stage]);

  function reset() {
    setStage("form");
    setName("");
    setDescription("");
    setErrors({});
    setMessage("");
    setCreated(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    if (!nextOpen) window.setTimeout(reset, 220);
  }

  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setErrors({});
    setMessage("");
    setStage("review");
  }

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        setErrors(body.error.fields ?? {});
        setMessage(body.error.message);
        setStage("form");
        window.setTimeout(() => nameRef.current?.focus(), 30);
        return;
      }
      const project = (await response.json()) as ProjectRecord;
      setCreated(project);
      setStage("success");
      router.refresh();
    } catch {
      setMessage(
        "Feedy could not reach the server. Check your connection and try again.",
      );
      setStage("form");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent aria-busy={pending}>
        {stage === "form" ? (
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={review}>
            <SheetHeader>
              <SheetTitle>New project</SheetTitle>
              <SheetDescription>
                Create a home for related feedback and project versions.
              </SheetDescription>
            </SheetHeader>
            {message ? (
              <div
                className="mx-6 mt-5 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {message}
              </div>
            ) : null}
            <SheetBody>
              <FieldGroup>
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="project-name">Project name</FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.name)}
                    autoComplete="off"
                    id="project-name"
                    maxLength={160}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Customer portal"
                    ref={nameRef}
                    required
                    value={name}
                  />
                  <FieldDescription>
                    Use the name your team already recognizes.
                  </FieldDescription>
                  <FieldError>{errors.name?.[0]}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="project-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    aria-invalid={Boolean(errors.description)}
                    id="project-description"
                    maxLength={4000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What work or release does this project cover?"
                    rows={6}
                    value={description}
                  />
                  <FieldDescription>
                    Optional · {description.length.toLocaleString()} / 4,000
                  </FieldDescription>
                  <FieldError>{errors.description?.[0]}</FieldError>
                </Field>
              </FieldGroup>
            </SheetBody>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Review project</Button>
            </SheetFooter>
          </form>
        ) : null}

        {stage === "review" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Review project</SheetTitle>
              <SheetDescription>
                Confirm these details before creating the project.
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <dl className="overflow-hidden rounded-lg border bg-card">
                <div className="grid gap-1 border-b px-4 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Name
                  </dt>
                  <dd className="text-sm font-medium text-foreground">
                    {name.trim()}
                  </dd>
                </div>
                <div className="grid gap-1 px-4 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Description
                  </dt>
                  <dd className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {description.trim() || "No description"}
                  </dd>
                </div>
              </dl>
            </SheetBody>
            <SheetFooter>
              <Button
                disabled={pending}
                type="button"
                variant="outline"
                onClick={() => setStage("form")}
              >
                Back to edit
              </Button>
              <Button disabled={pending} type="button" onClick={save}>
                {pending ? (
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Create project
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {stage === "success" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Project created</SheetTitle>
              <SheetDescription>
                {created?.name} is ready for feedback.
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <div
                className="flex flex-col items-start gap-4 rounded-lg border bg-card p-5"
                role="status"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 [&_svg]:size-5">
                  <CheckCircle2 aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-foreground">{created?.name}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    You can now add feedback from the dashboard or project page.
                  </p>
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
