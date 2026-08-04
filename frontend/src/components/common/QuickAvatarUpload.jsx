import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import Modal from './Modal';
import { memberApi } from '../../services/memberApi';

const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_MB = 5;

/**
 * Circular avatar with a hover camera badge that lets an authorized user
 * replace a member's photo inline (e.g. from a table row) without opening
 * the full Edit Member modal. Reuses the existing PUT /members/:id upload
 * path (and therefore the existing Cloudinary upload-then-swap-then-cleanup
 * logic in memberController.updateMember) — no new backend code.
 */
const QuickAvatarUpload = ({ member, size = 'sm', canEdit = true, onUpdated }) => {
  const inputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const openPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit || uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`Photo must be ${MAX_PHOTO_MB}MB or smaller.`);
      return;
    }

    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setConfirmOpen(true);
  };

  const cancel = () => {
    if (uploading) return;
    setConfirmOpen(false);
    setPreviewFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const confirmUpload = async () => {
    if (!previewFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', previewFile);
      // Same endpoint/middleware chain as the full Edit Member form:
      // verifyMemberPhotoBuffer -> saveMemberPhoto (Cloudinary) -> save ->
      // delete the old Cloudinary asset only after the swap succeeds.
      const { data } = await memberApi.update(member._id, formData);
      toast.success('Profile photo updated');
      onUpdated?.(data.data);
      cancel();
    } catch (err) {
      // Old photo is untouched server-side on failure — nothing to roll back here.
      toast.error(err.response?.data?.message || 'Could not update photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={!canEdit || uploading}
        title={canEdit ? 'Change photo' : undefined}
        className={`group/avatar relative shrink-0 rounded-full ${canEdit ? '' : 'cursor-default'}`}
      >
        <Avatar firstName={member.firstName} lastName={member.lastName} photo={member.photo} size={size} />
        {canEdit && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white opacity-0 shadow-sm ring-2 ring-white transition-opacity group-hover/avatar:opacity-100 dark:ring-gray-900">
            <Camera size={9} />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </button>

      <Modal open={confirmOpen} onClose={cancel} title="Update profile photo" size="sm">
        <div className="flex flex-col items-center gap-4">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-32 w-32 rounded-full object-cover ring-4 ring-gray-100 dark:ring-gray-800"
            />
          )}
          <p className="text-center text-xs text-gray-400">
            Replacing the photo for <span className="font-medium text-gray-600 dark:text-gray-300">{member.firstName} {member.lastName || ''}</span>
          </p>
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={uploading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmUpload}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading && <Loader2 size={14} className="animate-spin" />}
              {uploading ? 'Uploading...' : 'Confirm & Upload'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default QuickAvatarUpload;