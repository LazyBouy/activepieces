import { CreateOtpRequestBody, OtpType } from '@activepieces/shared';
import { t } from 'i18next';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';

import { authMutations } from '../hooks/auth-hooks';

const CheckEmailNote = ({ email, type }: CreateOtpRequestBody) => {
  const { mutate: resendVerification } = authMutations.useSendOtpEmail({
    onSuccess: () => {
      toast.success(
        type === OtpType.EMAIL_VERIFICATION
          ? t('Verification email resent, if previous one expired.')
          : t('Password reset link resent, if previous one expired.'),
        {
          duration: 3000,
        },
      );
    },
  });
  return (
    <div className="flex w-full flex-col gap-3 text-sm text-gray-11">
      <div className="flex w-full flex-row items-center gap-4">
        <MailCheck className="size-10 shrink-0 stroke-[1.5] text-gray-10" />
        <span className="w-fit text-left">
          {type === OtpType.EMAIL_VERIFICATION
            ? t('We sent you a link to complete your registration to')
            : t('We sent you a link to reset your password to')}
          <strong className="font-medium text-gray-12">&nbsp;{email}</strong>.
        </span>
      </div>
      <div className="flex flex-row flex-wrap gap-1 text-xs">
        {t("Didn't receive an email or it expired?")}
        <button
          type="button"
          className="cursor-pointer font-medium text-accent-9 transition-colors hover:text-accent-10 hover:underline"
          onClick={() =>
            resendVerification({
              email,
              type,
            })
          }
        >
          {t('Resend')}
        </button>
      </div>
    </div>
  );
};

CheckEmailNote.displayName = 'CheckEmailNote';
export { CheckEmailNote };
