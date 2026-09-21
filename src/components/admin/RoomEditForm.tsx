import { useEffect, useId, useRef, useState } from "react";
import { Camera, Image } from "lucide-react";
import { Textarea } from "@digdir/designsystemet-react";
import type { Room } from "../../../shared/types";
import { RoomPhoto } from "../RoomPhoto";
import { useT } from "../../i18n";
import { Button, ErrorState, Field, Input, Label } from "../ui";
import { FilterSelect } from "./FilterSelect";

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ImageContentType = (typeof IMAGE_TYPES)[number];

export type RoomImageFile = {
  filename: string;
  contentType: ImageContentType;
  data: string;
};

export type RoomEditPayload = {
  name: string;
  capacity: number;
  description: string;
  descriptionEn: string;
  capacityLabel: string;
  capacityLabelEn: string;
  requiresApproval: boolean;
  imageKind: "illustrative" | "actual";
  image?: string;
  amenities: string[];
  arrivalInfo: string;
  imageFile?: RoomImageFile;
};

export function RoomEditForm({
  room,
  onChange,
  mode,
  busy,
  error,
  onSubmit,
}: {
  room: Room;
  onChange: (room: Room) => void;
  mode?: "demo" | "live";
  busy: boolean;
  error?: Error;
  onSubmit: (payload: RoomEditPayload) => void;
}) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | undefined>(undefined);
  const pickRef = useRef(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const nameId = useId();
  const capacityId = useId();
  const labelId = useId();
  const labelEnId = useId();
  const descriptionId = useId();
  const descriptionEnId = useId();
  const amenitiesId = useId();
  const arrivalId = useId();
  const imageUrlId = useId();
  const fileId = useId();
  const [amenitiesText, setAmenitiesText] = useState(() =>
    room.amenities.join("\n"),
  );
  const [imageFile, setImageFile] = useState<RoomImageFile>();
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [reading, setReading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    const type = file.type as ImageContentType;
    if (!IMAGE_TYPES.includes(type)) {
      setFormError(t("admin.room_image_type"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError(t("admin.room_image_too_large"));
      return;
    }
    const pick = ++pickRef.current;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const preview = URL.createObjectURL(file);
    previewRef.current = preview;
    setImagePreview(preview);
    setImageName(file.name);
    setFormError(undefined);
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (pickRef.current !== pick) return;
      const current = roomRef.current;
      const result = String(reader.result || "");
      const data = result.includes(",")
        ? result.slice(result.indexOf(",") + 1)
        : result;
      setImageFile({ filename: file.name, contentType: type, data });
      setReading(false);
      onChange({
        ...current,
        imageKind: current.imageKind || "illustrative",
      });
    };
    reader.onerror = () => {
      if (pickRef.current === pick) setReading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <form
      className="room-edit-form"
      onSubmit={(event) => {
        event.preventDefault();
        const current = roomRef.current;
        onSubmit({
          name: current.name,
          capacity: current.capacity,
          description: current.description,
          descriptionEn: current.descriptionEn,
          capacityLabel: current.capacityLabel,
          capacityLabelEn: current.capacityLabelEn,
          requiresApproval: current.requiresApproval,
          imageKind: current.imageKind || "illustrative",
          image: current.image?.startsWith("/rooms/")
            ? undefined
            : current.image,
          amenities: amenitiesText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 20),
          arrivalInfo: current.arrivalInfo || "",
          ...(imageFile ? { imageFile } : {}),
        });
      }}
    >
      <div className="room-edit-side">
        <div className="room-edit-photo">
          <span className="eyebrow">{t("admin.room_image")}</span>
          <RoomPhoto
            room={{
              ...room,
              image: imagePreview || room.image,
            }}
          />
        </div>
        <Field>
          <Label>{t("admin.room_image_kind")}</Label>
          <FilterSelect
            label={t("admin.room_image_kind")}
            value={room.imageKind || "illustrative"}
            onChange={(imageKind) =>
              onChange({
                ...roomRef.current,
                imageKind: imageKind as "illustrative" | "actual",
              })
            }
            options={[
              {
                value: "illustrative",
                label: t("admin.room_image_illustrative"),
                icon: <Image size={18} />,
              },
              {
                value: "actual",
                label: t("admin.room_image_actual"),
                icon: <Camera size={18} />,
              },
            ]}
          />
        </Field>
        {mode === "live" ? (
          <Field>
            <Label htmlFor={imageUrlId}>{t("admin.room_image_url")}</Label>
            <Input
              id={imageUrlId}
              type="url"
              value={room.image?.startsWith("/rooms/") ? "" : room.image || ""}
              placeholder="https://"
              onChange={(event) =>
                onChange({ ...roomRef.current, image: event.target.value })
              }
            />
            <p className="caption">{t("admin.room_image_url_hint")}</p>
          </Field>
        ) : (
          <Field>
            <Label htmlFor={fileId}>{t("admin.room_image_upload")}</Label>
            <div className="room-edit-file-row">
              <input
                ref={fileRef}
                id={fileId}
                className="room-edit-file"
                type="file"
                accept="image/webp,image/jpeg,image/png"
                tabIndex={-1}
                onChange={(event) => {
                  chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
              >
                {t("admin.room_image_upload")}
              </Button>
              {imageName && (
                <span className="caption" role="status">
                  {imageName}
                </span>
              )}
            </div>
            <p className="caption">{t("admin.room_image_upload_hint")}</p>
          </Field>
        )}
      </div>
      <div className="room-edit-main">
        <div className="room-edit-pair">
          <Field>
            <Label htmlFor={nameId}>{t("admin.room_name")}</Label>
            <Input
              id={nameId}
              value={room.name}
              required
              maxLength={100}
              onChange={(event) =>
                onChange({ ...roomRef.current, name: event.target.value })
              }
            />
          </Field>
          <Field>
            <Label htmlFor={capacityId}>{t("admin.confirmed_capacity")}</Label>
            <Input
              id={capacityId}
              type="number"
              min={1}
              max={500}
              value={room.capacity}
              required
              onChange={(event) =>
                onChange({
                  ...roomRef.current,
                  capacity: Number(event.target.value),
                })
              }
            />
          </Field>
        </div>
        <div className="room-edit-pair">
          <Field>
            <Label htmlFor={labelId}>{t("admin.capacity_label")}</Label>
            <Input
              id={labelId}
              value={room.capacityLabel}
              maxLength={100}
              onChange={(event) =>
                onChange({
                  ...roomRef.current,
                  capacityLabel: event.target.value,
                })
              }
            />
          </Field>
          <Field>
            <Label htmlFor={labelEnId}>{t("admin.capacity_label_en")}</Label>
            <Input
              id={labelEnId}
              value={room.capacityLabelEn}
              maxLength={100}
              onChange={(event) =>
                onChange({
                  ...roomRef.current,
                  capacityLabelEn: event.target.value,
                })
              }
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor={descriptionId}>{t("admin.description")}</Label>
          <Textarea
            id={descriptionId}
            value={room.description}
            maxLength={3000}
            onChange={(event) =>
              onChange({
                ...roomRef.current,
                description: event.target.value,
              })
            }
          />
        </Field>
        <Field>
          <Label htmlFor={descriptionEnId}>{t("admin.description_en")}</Label>
          <Textarea
            id={descriptionEnId}
            value={room.descriptionEn}
            maxLength={3000}
            onChange={(event) =>
              onChange({
                ...roomRef.current,
                descriptionEn: event.target.value,
              })
            }
          />
        </Field>
        <Field>
          <Label htmlFor={amenitiesId}>{t("admin.room_amenities")}</Label>
          <Textarea
            id={amenitiesId}
            value={amenitiesText}
            maxLength={1600}
            onChange={(event) => setAmenitiesText(event.target.value)}
          />
          <p className="caption">{t("admin.room_amenities_hint")}</p>
        </Field>
        <Field>
          <Label htmlFor={arrivalId}>{t("admin.room_arrival_info")}</Label>
          <Textarea
            id={arrivalId}
            value={room.arrivalInfo || ""}
            maxLength={1000}
            onChange={(event) =>
              onChange({
                ...roomRef.current,
                arrivalInfo: event.target.value || undefined,
              })
            }
          />
        </Field>
        <label className="consent">
          <input
            type="checkbox"
            checked={room.requiresApproval}
            onChange={(event) =>
              onChange({
                ...roomRef.current,
                requiresApproval: event.target.checked,
              })
            }
          />
          {t("admin.bookings_need_approval")}
        </label>
      </div>
      <div className="room-edit-actions">
        {(formError || error) && (
          <ErrorState error={formError ? new Error(formError) : error!} />
        )}
        <Button type="submit" disabled={busy || reading}>
          {busy ? t("common.saving") : t("admin.save_changes")}
        </Button>
      </div>
    </form>
  );
}
