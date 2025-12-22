import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { showToast } from "@/utils/toast"
import { helpApi, HelpRequest } from "@/services/api"
import { Loader2, Upload, Image as ImageIcon, CheckCircle2 } from "lucide-react"

function formatDate(d?: string) {
  if (!d) return ""
  try {
    return new Date(d).toLocaleString()
  } catch {
    return d
  }
}

export default function Support() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [items, setItems] = useState<HelpRequest[]>([])

  const canSubmit = useMemo(() => title.trim().length >= 3 && content.trim().length >= 5, [title, content])

  const loadMy = async () => {
    setLoadingList(true)
    try {
      const data = await helpApi.getMy()
      setItems(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error(e)
      showToast.error(e?.response?.data?.message || "Failed to load your help requests")
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    void loadMy()
  }, [])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await helpApi.create({ title: title.trim(), content: content.trim(), imageFile: imageFile || undefined })
      showToast.success("Help request sent")
      setTitle("")
      setContent("")
      setImageFile(null)
      if (fileRef.current) fileRef.current.value = ""
      await loadMy()
    } catch (e: any) {
      console.error(e)
      showToast.error(e?.response?.data?.message || "Failed to send help request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Get Help</h1>
        <p className="text-sm text-muted-foreground">
          Send a support request to the admin. You can attach one image (optional).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New help request</CardTitle>
          <CardDescription>Include a clear title and as much detail as possible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="help-title">Title</Label>
            <Input
              id="help-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. I can’t upload my service image"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="help-content">Content</Label>
            <Textarea
              id="help-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what happened, what you expected, and any error message."
              className="min-h-[140px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>{imageFile ? imageFile.name : "No image selected"}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Choose image
                </Button>
                {imageFile ? (
                  <Button type="button" variant="ghost" onClick={() => setImageFile(null)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            {imagePreview ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <img src={imagePreview} alt="Preview" className="h-56 w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end">
            <Button disabled={!canSubmit || submitting} onClick={() => void submit()} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your previous requests</CardTitle>
          <CardDescription>Track what you’ve already sent and whether it was approved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No help requests yet.</div>
          ) : (
            <div className="space-y-4">
              {items.map((h) => (
                <div key={h.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold">{h.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Sent: {formatDate(h.createdAt)}
                        {h.approvedAt ? ` • Approved: ${formatDate(h.approvedAt)}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.status === "approved" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">{h.content}</div>

                  {h.imageUrl ? (
                    <div className="mt-3">
                      <a className="text-sm text-primary hover:underline" href={h.imageUrl} target="_blank" rel="noreferrer">
                        View attached image
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


