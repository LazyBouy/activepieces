import { CreateOtpRequestBody, OtpType } from '@activepieces/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { authenticationApi } from '@/api/authentication-api';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckEmailNote } from '@/features/authentication/components/check-email-note';
import { HttpError } from '@/lib/api';

import { AuthCard } from './auth-landing/auth-page-shell';

const FormSchema = z.object({
  email: z.string().min(1, t('Please enter your email')),
  type: CreateOtpRequestBody.shape.type,
});

type FormSchema = z.infer<typeof FormSchema>;

const ResetPasswordForm = () => {
  const [isSent, setIsSent] = useState<boolean>(false);
  const form = useForm<FormSchema>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      type: OtpType.PASSWORD_RESET,
    },
  });

  const { mutate, isPending } = useMutation<
    void,
    HttpError,
    CreateOtpRequestBody
  >({
    mutationFn: authenticationApi.sendOtpEmail,
    onSuccess: () => setIsSent(true),
  });

  const onSubmit: SubmitHandler<CreateOtpRequestBody> = (data) => {
    mutate(data);
  };

  return (
    <AuthCard>
      <div className="mb-8 text-center">
        <h1 className="text-center text-xl font-normal text-balance text-gray-12">
          {isSent ? t('Check Your Inbox') : t('Reset Password')}
        </h1>
        {!isSent && (
          <p className="mx-auto mt-1.5 text-sm text-balance text-gray-11">
            {t(
              `If the user exists we'll send you an email with a link to reset your password.`,
            )}
          </p>
        )}
      </div>
      {isSent ? (
        <div className="text-sm text-gray-11">
          <CheckEmailNote
            email={form.getValues().email.trim().toLocaleLowerCase()}
            type={OtpType.PASSWORD_RESET}
          />
        </div>
      ) : (
        <Form {...form}>
          <form className="flex flex-col">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col gap-1">
                  <Label htmlFor="email">{t('Email')}</Label>
                  <Input
                    {...field}
                    id="email"
                    type="text"
                    placeholder={'email@example.com'}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              size="lg"
              className="mx-auto mt-8 min-w-24"
              loading={isPending}
              onClick={(e) => form.handleSubmit(onSubmit)(e)}
            >
              {t('Send Password Reset Link')}
            </Button>
          </form>
        </Form>
      )}
      <div className="mt-4 text-center text-sm">
        <Link
          to="/sign-in"
          className="text-accent-9 transition-colors hover:text-accent-10 hover:underline"
        >
          {t('Back to sign in')}
        </Link>
      </div>
    </AuthCard>
  );
};

ResetPasswordForm.displayName = 'ResetPassword';

export { ResetPasswordForm };
