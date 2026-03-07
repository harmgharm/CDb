"use client";

import { CalendarIcon, ClockIcon, PencilIcon, StarIcon, Trash2Icon, UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/media/confirm-delete-dialog";
import { EditSessionDialog } from "@/components/media/edit-session-dialog";
import { ScoreSelector, SubmitRatingDialog } from "@/components/media/submit-rating-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteRating, useDeleteSession, useUpdateRating } from "@/hooks/use-sessions";
import type { MediaRating, MediaSession } from "@/types/media-responses";

function getInitials(name: string | null, username: string): string {
  const display = name ?? username;
  return display
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(time24: string): string {
  const [hoursString = "0", minutesString = "00"] = time24.split(":");
  const hours = Number(hoursString);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours)}:${minutesString} ${period}`;
}

// ============================================
// Edit Rating Dialog
// ============================================

interface EditRatingDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly rating: MediaRating;
  readonly onSaved: () => void;
}

function EditRatingDialog({ open, onOpenChange, rating, onSaved }: EditRatingDialogProps) {
  const { updateRating, isUpdating } = useUpdateRating();
  const [score, setScore] = useState(rating.score);
  const [review, setReview] = useState(rating.review ?? "");

  async function handleSave() {
    const success = await updateRating(rating.id, {
      score,
      review: review.length > 0 ? review : undefined,
    });
    if (success) {
      toast.success("Rating updated");
      onOpenChange(false);
      onSaved();
    } else {
      toast.error("Failed to update rating");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Rating</DialogTitle>
          <DialogDescription>Update your score and review.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Score (1-10)</Label>
            <ScoreSelector score={score} onSelect={setScore} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-review">Review (optional)</Label>
            <Textarea
              id="edit-review"
              value={review}
              onChange={(event) => {
                setReview(event.target.value);
              }}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={isUpdating || score < 1 || score > 10}
            onClick={() => {
              void handleSave();
            }}
          >
            {isUpdating ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Rating Row
// ============================================

interface RatingRowProps {
  readonly rating: MediaRating;
  readonly currentUserId: string | null;
  readonly isModeratorOrAdmin: boolean;
  readonly onChanged: () => void;
}

function RatingRow({ rating, currentUserId, isModeratorOrAdmin, onChanged }: RatingRowProps) {
  const { deleteRating, isDeleting } = useDeleteRating();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const isOwn = currentUserId === rating.user_id;
  const canEdit = isOwn || isModeratorOrAdmin;
  const canDelete = isOwn || isModeratorOrAdmin;

  async function handleDelete() {
    const success = await deleteRating(rating.id);
    if (success) {
      toast.success("Rating deleted");
      setShowDelete(false);
      onChanged();
    } else {
      toast.error("Failed to delete rating");
    }
  }

  return (
    <>
      <div className="group flex items-center gap-2">
        <Avatar className="size-6">
          <AvatarImage
            src={rating.avatar_url ?? undefined}
            alt={rating.display_name ?? rating.username}
          />
          <AvatarFallback className="text-[10px]">
            {getInitials(rating.display_name, rating.username)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{rating.display_name ?? rating.username}</span>
        <div className="flex items-center gap-0.5">
          <StarIcon className="size-3 fill-amber-500 text-amber-500" />
          <span className="text-sm font-medium">{String(rating.score)}</span>
        </div>
        {rating.review !== null && rating.review.length > 0 && (
          <span className="text-muted-foreground truncate text-xs italic">— {rating.review}</span>
        )}
        {(canEdit || canDelete) && (
          <div className="ml-auto flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => {
                  setShowEdit(true);
                }}
              >
                <PencilIcon className="size-3" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive size-6"
                onClick={() => {
                  setShowDelete(true);
                }}
              >
                <Trash2Icon className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {showEdit && (
        <EditRatingDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          rating={rating}
          onSaved={onChanged}
        />
      )}

      <ConfirmDeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Rating"
        description={`Delete ${rating.display_name ?? rating.username}'s rating of ${String(rating.score)}/10?`}
        isDeleting={isDeleting}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </>
  );
}

// ============================================
// Session Card
// ============================================

interface SessionCardProps {
  readonly session: MediaSession;
  readonly ratings: MediaRating[];
  readonly currentUserId: string | null;
  readonly isModeratorOrAdmin: boolean;
  readonly mediaTitle: string;
  readonly onChanged: () => void;
}

export function SessionCard({
  session,
  ratings,
  currentUserId,
  isModeratorOrAdmin,
  mediaTitle,
  onChanged,
}: SessionCardProps) {
  const { deleteSession, isDeleting } = useDeleteSession();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const sessionRatings = ratings.filter((r) => r.session_id === session.id);

  const isCreator = currentUserId !== null && currentUserId === session.created_by_user_id;
  const canEditSession = isModeratorOrAdmin || isCreator;
  const canDeleteSession = isModeratorOrAdmin || isCreator;

  const isAttendee =
    currentUserId !== null && session.attendees.some((a) => a.user_id === currentUserId);
  const hasRated =
    currentUserId !== null && sessionRatings.some((r) => r.user_id === currentUserId);
  const canRate = isAttendee && !hasRated;

  async function handleDeleteSession() {
    const success = await deleteSession(session.id);
    if (success) {
      toast.success("Session deleted");
      setShowDelete(false);
      onChanged();
    } else {
      toast.error("Failed to delete session");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="text-muted-foreground size-4" />
              <CardTitle className="text-sm font-medium">
                {formatDate(session.date_watched)}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {session.time_watched_at !== null && (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <ClockIcon className="size-3" />
                  {formatTime(session.time_watched_at)}
                </div>
              )}
              {canRate && (
                <SubmitRatingDialog
                  sessionId={session.id}
                  mediaTitle={mediaTitle}
                  dateWatched={session.date_watched}
                  onRated={onChanged}
                />
              )}
              {canEditSession && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => {
                    setShowEdit(true);
                  }}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              )}
              {canDeleteSession && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 size-7"
                  onClick={() => {
                    setShowDelete(true);
                  }}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <UserIcon className="text-muted-foreground size-3.5" />
            <span className="text-muted-foreground">Picked by</span>
            <span className="font-medium">
              {session.picker_id === null
                ? "Group pick"
                : (session.picker_display_name ?? session.picker_username)}
            </span>
          </div>

          {session.attendees.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Watched by</span>
              <div className="flex flex-wrap gap-1">
                {session.attendees.map((attendee) => {
                  const hasRated = sessionRatings.some((r) => r.user_id === attendee.user_id);
                  const canAdminRate = isModeratorOrAdmin && !hasRated;
                  const attendeeName = attendee.display_name ?? attendee.username;

                  return (
                    <Badge key={attendee.user_id} variant="secondary" className="gap-1 text-xs">
                      {attendeeName}
                      {canAdminRate && (
                        <SubmitRatingDialog
                          sessionId={session.id}
                          mediaTitle={mediaTitle}
                          dateWatched={session.date_watched}
                          onRated={onChanged}
                          onBehalfOf={{ id: attendee.user_id, name: attendeeName }}
                        />
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {session.notes !== null && session.notes.length > 0 && (
            <p className="text-muted-foreground text-sm italic">&ldquo;{session.notes}&rdquo;</p>
          )}

          {sessionRatings.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                {sessionRatings.map((rating) => (
                  <RatingRow
                    key={rating.id}
                    rating={rating}
                    currentUserId={currentUserId}
                    isModeratorOrAdmin={isModeratorOrAdmin}
                    onChanged={onChanged}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showEdit && (
        <EditSessionDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          session={session}
          onSaved={onChanged}
        />
      )}

      <ConfirmDeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Session"
        description={`Delete the session from ${formatDate(session.date_watched)}? All ratings for this session will also be deleted.`}
        isDeleting={isDeleting}
        onConfirm={() => {
          void handleDeleteSession();
        }}
      />
    </>
  );
}
