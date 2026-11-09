import { useState, useRef, type ChangeEvent } from "react";
import { toast } from "sonner";
import type { NewFormState } from "../types";
import { makeEmptyNewForm } from "../utils";

/** State + handlers for the "new profile" wizard step (form, photo, ID documents). */
export function useNewProfileForm(ar: boolean) {
  // Full New Person Profile State
  const [newForm, setNewForm] = useState<NewFormState>(makeEmptyNewForm());

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoData(result);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setPhotoData(null);
    if (photoRef.current) photoRef.current.value = "";
  };

  const handleDocSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(ar ? `${file.name} كبير جداً (الأقصى 5 ميجا)` : `${file.name} is too large (max 5MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setNewForm((prev) => ({
          ...prev,
          idDocuments: [
            ...(prev.idDocuments || []),
            { fileName: file.name, fileType: file.type || "image/jpeg", fileData: reader.result as string },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    if (docsRef.current) docsRef.current.value = "";
  };

  const removeDoc = (index: number) => {
    setNewForm((prev) => {
      const newDocs = [...(prev.idDocuments || [])];
      newDocs.splice(index, 1);
      return { ...prev, idDocuments: newDocs };
    });
  };

  return {
    newForm, setNewForm,
    photoPreview, photoData, photoRef, docsRef,
    handlePhotoSelect, clearPhoto, handleDocSelect, removeDoc,
  };
}
