import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import { LoginInput, LoginSchema, UserResponse } from '@fintrack/shared';
import { api } from '../../lib/api';
import { apiErrorToMessage } from '../../lib/apiError';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),

    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      const res = await api.post<{ data: { user: UserResponse } }>('/auth/login', data);
      setUser(res.data.data.user);
      navigate('/app', { replace: true });
    } catch (err) {
      setServerError(apiErrorToMessage(err));
    }
  };

  return (
    <Card className="border-border/60 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-extrabold tracking-tight">Xush kelibsiz!</CardTitle>
        <CardDescription>
          FinTrack shaxsiy hisobingizga kirish uchun maʼlumotlaringizni kiriting
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-xs font-semibold text-destructive">
              {serverError}
            </div>
          )}

          <div className="relative">
            <Input
              label="Elektron pochta"
              type="email"
              placeholder="ism@mail.uz"
              error={errors.email?.message}
              {...register('email')}
            />
            <Mail className="pointer-events-none absolute right-3.5 top-[38px] h-4 w-4 text-muted-foreground" />
          </div>

          <div className="relative">
            <Input
              label="Parol"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-[38px] text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button type="submit" className="w-full h-11" loading={isSubmitting}>
            <span>Kirish</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-2 border-t border-border/60 pt-4 text-center text-sm">
        <p className="text-muted-foreground">
          Profilingiz yo‘qmi?{' '}
          <Link
            to="/register"
            className="font-bold text-primary hover:underline underline-offset-4"
          >
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
