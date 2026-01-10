"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Upload, Link2, Download, Facebook, Instagram, Music2 } from "lucide-react";
import { AppSettings } from "@/types";
import { toast } from "sonner";
import { getAllCookies, setCookie } from "@/lib/client-cookies";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Cropper, { type Area } from "react-easy-crop";

async function runMockDataAction(action: "seed" | "clear") {
  const res = await fetch("/api/admin/mock-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof payload?.error === "string" && payload.error
        ? payload.error
        : "Request failed";
    throw new Error(message);
  }

  return payload;
}

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
};

const getCroppedLogoDataUrl = async (
  imageSrc: string,
  crop: Area,
  shape: "square" | "circle"
): Promise<string> => {
  const image = await createImage(imageSrc);

  const pixelRatio = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(crop.height * pixelRatio));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = "high";

  if (shape === "circle") {
    ctx.clearRect(0, 0, crop.width, crop.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(crop.width / 2, crop.height / 2, crop.width / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  if (shape === "circle") {
    ctx.restore();
  }

  // PNG keeps transparency for circle mode.
  return canvas.toDataURL("image/png");
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [uploadMethod, setUploadMethod] = React.useState<"url" | "upload">(
    "upload"
  );
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);

  const [logoCropOpen, setLogoCropOpen] = React.useState(false);
  const [logoCropSrc, setLogoCropSrc] = React.useState<string>("");
  const [logoCrop, setLogoCrop] = React.useState({ x: 0, y: 0 });
  const [logoZoom, setLogoZoom] = React.useState(1);
  const [logoCroppedAreaPixels, setLogoCroppedAreaPixels] = React.useState<
    Area | null
  >(null);
  const [logoCropSaving, setLogoCropSaving] = React.useState(false);

  // Persist the latest crop input/area so switching shape updates the preview
  // even after the crop dialog is closed.
  const [logoLastCropSrc, setLogoLastCropSrc] = React.useState<string>("");
  const [logoLastCroppedAreaPixels, setLogoLastCroppedAreaPixels] =
    React.useState<Area | null>(null);

  const [formData, setFormData] = React.useState<Partial<AppSettings>>({
    businessName: "",
    businessDescription: "",
    webAddress: "",
    logoUrl: "",
    logoShape: "square",
    mealTypes: [],
    weekStartDay: "monday",
    facebookUrl: "",
    instagramUrl: "",
  });

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deletePending, setDeletePending] = React.useState(false);

  const [profileFullName, setProfileFullName] = React.useState("");
  const [profilePhone, setProfilePhone] = React.useState("");

  React.useEffect(() => {
    const next =
      user?.role === "admin" && typeof user?.full_name === "string"
        ? user.full_name
        : "";
    setProfileFullName(next || "");
  }, [user?.role, user?.full_name]);

  React.useEffect(() => {
    const next =
      user?.role === "admin" && typeof (user as any)?.phone === "string"
        ? String((user as any).phone)
        : "";
    setProfilePhone(next || "");
  }, [user?.role, (user as any)?.phone]);

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => db.entities.AppSettings.list(),
  });

  React.useEffect(() => {
    if (settings.length > 0) {
      const s = settings[0] as any;
      setFormData({
        ...s,
        logoShape: s?.logoShape === "circle" ? "circle" : "square",
        mealTypes: Array.isArray(s?.mealTypes)
          ? s.mealTypes.map((v: any) => String(v ?? "").trim()).filter(Boolean)
          : [],
      });
    }
  }, [settings]);

  React.useEffect(() => {
    if (uploadMethod !== "upload") return;
    if (!String(formData.logoUrl ?? "").trim()) return;
    if (!logoLastCropSrc || !logoLastCroppedAreaPixels) return;

    let cancelled = false;
    (async () => {
      try {
        const next = await getCroppedLogoDataUrl(
          logoLastCropSrc,
          logoLastCroppedAreaPixels,
          formData.logoShape === "circle" ? "circle" : "square"
        );

        if (cancelled) return;
        setFormData((prev) => ({ ...prev, logoUrl: next }));
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    uploadMethod,
    formData.logoShape,
    formData.logoUrl,
    logoLastCropSrc,
    logoLastCroppedAreaPixels,
  ]);

  const startLogoCrop = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);
    try {
      const src = await readFileAsDataUrl(file);
      if (!src) throw new Error("Failed to read image");

      setLogoCropSrc(src);
      setLogoCrop({ x: 0, y: 0 });
      setLogoZoom(1);
      setLogoCroppedAreaPixels(null);
      setLogoCropOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load logo");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    await startLogoCrop(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleExportData = () => {
    // Server-side export (ZIP containing JSON + CSV)
    window.location.href = "/api/me/export";
  };

  const handleDeleteAccount = async () => {
    if (deletePending) return;
    if (deleteConfirmText !== "DELETE") {
      toast.error("Type DELETE to confirm.");
      return;
    }

    setDeletePending(true);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: deleteConfirmText }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }

      window.location.href = "/goodbye";
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete account");
    } finally {
      setDeletePending(false);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        let importCount = 0;
        const promises: Promise<any>[] = [];

        // Iterate over keys like "progrr_entity_Client", "progrr_entity_MealPlan"
        for (const key of Object.keys(data)) {
          if (key.startsWith("progrr_entity_")) {
            const entityName = key.replace("progrr_entity_", "");
            const items = data[key];

            if (Array.isArray(items)) {
              for (const item of items) {
                // Create via API (Prisma)
                // This preserves the existing 'id' inside the JSON blob,
                // while generating a new primary key UUID for the table.
                promises.push(db.entities[entityName].create(item));
                importCount++;
              }
            }
          }
        }

        if (importCount > 0) {
          toast.promise(Promise.all(promises), {
            loading: `Importing ${importCount} items...`,
            success: () => {
              setTimeout(() => window.location.reload(), 1500);
              return "Data imported successfully!";
            },
            error: "Failed to import data",
          });
        } else {
          toast.info("No importable data found in file.");
        }
      } catch (error) {
        console.error("Import failed:", error);
        toast.error("Failed to import data. Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const upsertAppSettings = async (data: Partial<AppSettings>) => {
    if (settings.length > 0) {
      return db.entities.AppSettings.update(settings[0].id, data);
    }
    return db.entities.AppSettings.create(data);
  };

  const saveBusinessMutation = useMutation({
    mutationFn: upsertAppSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      toast.success("Business info saved");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save business info");
    },
  });

  const saveSocialMutation = useMutation({
    mutationFn: upsertAppSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save social links");
    },
  });

  const seedMockMutation = useMutation({
    mutationFn: () => runMockDataAction("seed"),
    onSuccess: () => {
      // Drop cached entity lists so seeded data shows immediately everywhere.
      [
        ["clients"],
        ["workoutPlans"],
        ["workoutPlanExerciseCounts"],
        ["mealPlans"],
        ["meetings"],
        ["messages"],
        ["exerciseLibrary"],
        ["foodLibrary"],
      ].forEach((queryKey) => queryClient.removeQueries({ queryKey }));

      queryClient.invalidateQueries();
      toast.success("Mock data generated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to generate mock data");
    },
  });

  const clearMockMutation = useMutation({
    mutationFn: () => runMockDataAction("clear"),
    onSuccess: () => {
      // Ensure the UI doesn't keep showing stale cached data after clear.
      [
        ["clients"],
        ["workoutPlans"],
        ["workoutPlanExerciseCounts"],
        ["mealPlans"],
        ["meetings"],
        ["messages"],
        ["exerciseLibrary"],
        ["foodLibrary"],
      ].forEach((queryKey) => queryClient.removeQueries({ queryKey }));

      queryClient.invalidateQueries();
      toast.success("Mock data cleared successfully");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to clear mock data");
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: { fullName: string; phone: string }) => {
      const res = await fetch("/api/me/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: payload.fullName,
          phone: payload.phone,
        }),
      });

      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (response as any)?.error || `Request failed (${res.status})`
        );
      }

      return response;
    },
    onSuccess: async () => {
      toast.success("Profile updated");
      await refreshUser({ force: true });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update profile");
    },
  });

  return (
    <div className="p-8 bg-[#F5F6F8] dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure your coaching portal
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className={user?.role === "admin" ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "space-y-6"}>
          {user?.role === "admin" ? (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full name
                    </label>
                    <Input
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveProfileMutation.mutate({
                            fullName: profileFullName,
                            phone: profilePhone,
                          });
                        }
                      }}
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <Input
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="Your phone"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Facebook
                    </label>
                    <div className="relative">
                      <Facebook className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={formData.facebookUrl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            facebookUrl: e.target.value,
                          })
                        }
                        placeholder="https://facebook.com/yourpage"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instagram
                    </label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={formData.instagramUrl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            instagramUrl: e.target.value,
                          })
                        }
                        placeholder="https://instagram.com/yourprofile"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      TikTok
                    </label>
                    <div className="relative">
                      <Music2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={String((formData as any).tiktokUrl || "")}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tiktokUrl: e.target.value,
                          } as any)
                        }
                        placeholder="https://tiktok.com/@yourprofile"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t">
                <Button
                  type="button"
                  onClick={async () => {
                    if (
                      saveProfileMutation.isPending ||
                      saveSocialMutation.isPending
                    ) {
                      return;
                    }
                    try {
                      await saveProfileMutation.mutateAsync({
                        fullName: profileFullName,
                        phone: profilePhone,
                      });

                      await saveSocialMutation.mutateAsync({
                        facebookUrl: formData.facebookUrl,
                        instagramUrl: formData.instagramUrl,
                        tiktokUrl: String((formData as any).tiktokUrl || ""),
                      } as any);
                    } catch {
                      // Individual mutations already toast errors.
                    }
                  }}
                  disabled={
                    saveProfileMutation.isPending ||
                    saveSocialMutation.isPending
                  }
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saveProfileMutation.isPending || saveSocialMutation.isPending
                    ? "Saving..."
                    : "Save Profile"}
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {/* Business Information */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Business Name
                  </label>
                  <Input
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={formData.businessDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessDescription: e.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Tell clients about your coaching services..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={formData.webAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, webAddress: e.target.value })
                      }
                      placeholder="https://yourwebsite.com"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Logo
                  </label>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* Upload (narrower) */}
                    <div className="w-full sm:max-w-md">
                      <div className="flex flex-col gap-1 mb-3">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Source
                        </div>
                        <div className="inline-flex w-full rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadMethod("url")}
                            className={`flex-1 rounded-l-md rounded-r-none px-3 gap-2 ${uploadMethod === "url"
                              ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-200"
                              : ""
                              }`}
                          >
                            <Link2 className="w-4 h-4" />
                            URL
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadMethod("upload")}
                            className={`flex-1 rounded-r-md rounded-l-none px-3 gap-2 border-l border-gray-200 dark:border-gray-700 ${uploadMethod === "upload"
                              ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-200"
                              : ""
                              }`}
                          >
                            <Upload className="w-4 h-4" />
                            Upload
                          </Button>
                        </div>

                        <div className="mt-3">
                          <label className="sr-only">Shape</label>
                          <Select
                            value={
                              formData.logoShape === "circle" ? "circle" : "square"
                            }
                            onValueChange={(v) =>
                              setFormData({
                                ...formData,
                                logoShape: v === "circle" ? "circle" : "square",
                              })
                            }
                          >
                            <SelectTrigger className="w-full justify-between">
                              <SelectValue placeholder="Shape" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="square">Square</SelectItem>
                              <SelectItem value="circle">Circle</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {uploadMethod === "url" ? (
                        <Input
                          value={formData.logoUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, logoUrl: e.target.value })
                          }
                          placeholder="https://example.com/logo.png"
                        />
                      ) : (
                        <div
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed ${formData.logoShape === "circle" ? "rounded-lg" : "rounded-none"
                            } p-6 text-center transition-colors ${dragActive
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                              : "border-gray-300 dark:border-gray-700"
                            }`}
                        >
                          {uploading ? (
                            <p className="text-gray-600 dark:text-gray-400">
                              Loading...
                            </p>
                          ) : formData.logoUrl ? (
                            <div className="space-y-3">
                              <div
                                className={`mx-auto h-24 w-24 overflow-hidden ${formData.logoShape === "circle"
                                  ? "rounded-full"
                                  : "rounded-none"
                                  }`}
                              >
                                <img
                                  src={formData.logoUrl}
                                  alt="Logo"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    document.getElementById("logo-upload")?.click()
                                  }
                                >
                                  Change Logo
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setFormData({ ...formData, logoUrl: "" });
                                    setLogoLastCropSrc("");
                                    setLogoLastCroppedAreaPixels(null);
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-10 h-10 mx-auto text-gray-400" />
                              <p className="text-gray-600 dark:text-gray-400">
                                Drag and drop your logo here
                              </p>
                              <p className="text-sm text-gray-500">or</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  document.getElementById("logo-upload")?.click()
                                }
                              >
                                Browse Files
                              </Button>
                            </div>
                          )}
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(e.target.files[0]);
                                e.target.value = "";
                              }
                            }}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </CardContent>
            <CardFooter className="justify-end border-t">
              <Button
                type="button"
                onClick={() =>
                  saveBusinessMutation.mutate({
                    businessName: formData.businessName,
                    businessDescription: formData.businessDescription,
                    webAddress: formData.webAddress,
                    logoUrl: formData.logoUrl,
                    logoShape:
                      formData.logoShape === "circle" ? "circle" : "square",
                  })
                }
                disabled={saveBusinessMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saveBusinessMutation.isPending
                  ? "Saving..."
                  : "Save Business info"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Mock Data (hidden) */}
        {/*
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Mock Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate a detailed demo dataset (clients, plans, meals, meetings,
                and messages) to test your project. Clear will wipe all clients,
                plans, meals, foods, meetings, and messages for this admin.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={
                    seedMockMutation.isPending || clearMockMutation.isPending
                  }
                  onClick={() => {
                    const ok = window.confirm(
                      "Generate mock data now? This will first remove any previously generated mock data."
                    );
                    if (!ok) return;
                    seedMockMutation.mutate();
                  }}
                >
                  {seedMockMutation.isPending
                    ? "Generating..."
                    : "Generate Mock Data"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/10"
                  disabled={
                    seedMockMutation.isPending || clearMockMutation.isPending
                  }
                  onClick={() => {
                    const ok = window.confirm(
                      "Clear data now? This will delete all clients, plans, meals, foods, meetings, and messages for this admin."
                    );
                    if (!ok) return;
                    clearMockMutation.mutate();
                  }}
                >
                  {clearMockMutation.isPending
                    ? "Clearing..."
                    : "Clear Mock Data"}
                </Button>
              </div>
            </CardContent>
          </Card>
          */}

        {/* Data Management */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Export your account data as a ZIP archive (JSON + CSV), or
                import a previously saved legacy JSON backup.
              </p>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportData}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data (ZIP)
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button type="button" variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Permanently delete your admin account. This is irreversible.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteOpen(true);
              }}
            >
              Delete Account
            </Button>
          </CardContent>
        </Card>

      </div>

      <Dialog
        open={logoCropOpen}
        onOpenChange={(open) => {
          if (logoCropSaving) return;
          setLogoCropOpen(open);
          if (!open) {
            setLogoCropSrc("");
            setLogoCroppedAreaPixels(null);
          }
        }}
      >
        <DialogContent className="w-[92vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop your logo</DialogTitle>
            <DialogDescription>
              Drag the image and zoom to choose what shows. The crop shape
              follows your selected Shape (square or circle).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative w-full h-[340px] rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900">
              {logoCropSrc ? (
                <Cropper
                  image={logoCropSrc}
                  crop={logoCrop}
                  zoom={logoZoom}
                  aspect={1}
                  cropShape={
                    formData.logoShape === "circle" ? "round" : "rect"
                  }
                  showGrid={true}
                  onCropChange={setLogoCrop}
                  onZoomChange={setLogoZoom}
                  onCropComplete={(_, croppedPixels) => {
                    setLogoCroppedAreaPixels(croppedPixels);
                  }}
                />
              ) : null}
            </div>

            <div className="w-full md:w-[240px] shrink-0 space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Zoom</div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={logoZoom}
                  onChange={(e) => setLogoZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Shape preview</div>
                <div
                  className={`h-24 w-24 bg-gray-200 dark:bg-gray-800 overflow-hidden ${formData.logoShape === "circle" ? "rounded-full" : "rounded-none"
                    }`}
                >
                  {logoCropSrc ? (
                    <img
                      src={logoCropSrc}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Final logo will be saved as a {formData.logoShape === "circle" ? "circle" : "square"}.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={logoCropSaving}
              onClick={() => setLogoCropOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                logoCropSaving || !logoCropSrc || !logoCroppedAreaPixels
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={async () => {
                if (!logoCropSrc || !logoCroppedAreaPixels) return;
                setLogoCropSaving(true);
                try {
                  const next = await getCroppedLogoDataUrl(
                    logoCropSrc,
                    logoCroppedAreaPixels,
                    formData.logoShape === "circle" ? "circle" : "square"
                  );
                  setLogoLastCropSrc(logoCropSrc);
                  setLogoLastCroppedAreaPixels(logoCroppedAreaPixels);
                  setFormData((prev) => ({ ...prev, logoUrl: next }));
                  setLogoCropOpen(false);
                  toast.success("Logo updated");
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to crop logo");
                } finally {
                  setLogoCropSaving(false);
                }
              }}
            >
              {logoCropSaving ? "Saving..." : "Apply crop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={!deletePending}>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Deleting your account will permanently remove all your data,
              including access to all clients, programs, and history. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">You will lose:</div>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>Access to the system</li>
                <li>All managed clients</li>
                <li>All programs, plans, and data</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                Strongly recommended: export your data first
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = "/api/me/export";
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data (ZIP)
              </Button>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium block mb-1 select-none"
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              >
                Type DELETE to confirm
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="DELETE"
                disabled={deletePending}
              />
              <p className="text-xs text-muted-foreground">
                For security, deletion requires recent authentication (log in
                again if needed).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={
                deletePending ||
                deleteConfirmText.trim().toUpperCase() !== "DELETE"
              }
            >
              {deletePending ? "Deleting..." : "Delete account permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
