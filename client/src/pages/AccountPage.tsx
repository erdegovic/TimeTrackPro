import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Lock, User, Key, Upload, Loader2, CreditCard, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import ProfileForm from '@/components/Auth/ProfileForm';
import { Link } from 'wouter';
import { getPlanDetails, planDetails } from '@/lib/plans';
import type { SubscriptionPlan } from '@shared/subscriptions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Password form schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const selectedTab = new URLSearchParams(window.location.search).get('tab') === 'subscription' ? 'subscription' : 'profile';
  const currentPlan = (user?.subscriptionPlan || 'free') as SubscriptionPlan;
  const currentPlanDetails = getPlanDetails(currentPlan);

  const downgradePlan = async (plan: SubscriptionPlan) => {
    setIsChangingPlan(true);
    try {
      const response = await fetch('/api/auth/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Plan could not be updated.');
      queryClient.setQueryData(['/api/auth/user'], result.user);
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ title: 'Plan updated', description: result.message });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Plan update failed', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Avatar upload handler
  const handleAvatarClick = () => {
    if (!isAvatarUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      toast({ variant: 'destructive', title: 'Unsupported image', description: 'Choose a PNG, JPEG, WEBP, or GIF image.' });
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Image is too large', description: 'Choose an image smaller than 5 MB.' });
      event.target.value = '';
      return;
    }

    const previousAvatar = avatarUrl;
    setIsAvatarUploading(true);

    // In a real app, you would upload the file to a server
    // For now, just use a local URL
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        setAvatarUrl(e.target.result.toString());
        
        // Send to server
        try {
          const response = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              avatarUrl: e.target.result.toString() 
            }),
            credentials: 'include',
          });
          
          if (response.ok) {
            const result = await response.json();
            toast({
              title: 'Avatar updated',
              description: 'Your profile picture has been updated successfully',
            });
            
            // Update user in react-query cache
            queryClient.setQueryData(['/api/auth/user'], result.user);
            await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          } else {
            const error = await response.json().catch(() => ({}));
            setAvatarUrl(previousAvatar);
            toast({
              variant: 'destructive',
              title: 'Update failed',
              description: error.message || 'Failed to update avatar',
            });
          }
        } catch (error) {
          console.error('Error updating avatar:', error);
          setAvatarUrl(previousAvatar);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'An unexpected error occurred',
          });
        } finally {
          setIsAvatarUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      setIsAvatarUploading(false);
      event.target.value = '';
      toast({ variant: 'destructive', title: 'Could not read image', description: 'Please choose the file again.' });
    };
    reader.readAsDataURL(file);
  };

  // Password update handler
  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsUpdating(true);
    
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      
      if (response.ok) {
        toast({
          title: 'Password updated',
          description: 'Your password has been updated successfully',
        });
        
        // Reset form
        passwordForm.reset({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: errorData.message || 'Failed to update password',
        });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 lg:py-10 px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Account Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-4 sm:gap-6">
        {/* Left sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 cursor-pointer overflow-hidden rounded-full" onClick={handleAvatarClick}>
                    <AvatarImage src={avatarUrl || user?.profileImageUrl || undefined} alt="Profile" className="h-full w-full object-cover" />
                    <AvatarFallback className="bg-gray-100">
                      <User className="h-10 w-10 text-gray-400" />
                    </AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground" 
                    onClick={handleAvatarClick}
                    disabled={isAvatarUploading}
                    title="Upload profile picture"
                    aria-label="Upload profile picture"
                  >
                    {isAvatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    disabled={isAvatarUploading}
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-sm sm:text-base font-medium">{user?.firstName} {user?.lastName}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main content */}
        <div className="space-y-4 sm:space-y-6">
          <Tabs defaultValue={selectedTab}>
            <TabsList className="mb-4 w-full grid grid-cols-3">
              <TabsTrigger value="profile" className="flex items-center text-xs sm:text-sm">
                <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Profile</span>
                <span className="sm:hidden">Info</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center text-xs sm:text-sm">
                <Lock className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="subscription" className="flex items-center text-xs sm:text-sm">
                <CreditCard className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Plan
              </TabsTrigger>
            </TabsList>
            
            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and contact details.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {user && <ProfileForm user={user} />}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Security Tab */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl>
                              <div className="flex items-center">
                                <span className="absolute pl-3 text-gray-400">
                                  <Key className="h-4 w-4" />
                                </span>
                                <Input 
                                  type="password" 
                                  placeholder="••••••••" 
                                  className="pl-10" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <div className="flex items-center">
                                <span className="absolute pl-3 text-gray-400">
                                  <Key className="h-4 w-4" />
                                </span>
                                <Input 
                                  type="password" 
                                  placeholder="••••••••" 
                                  className="pl-10" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <div className="flex items-center">
                                <span className="absolute pl-3 text-gray-400">
                                  <Key className="h-4 w-4" />
                                </span>
                                <Input 
                                  type="password" 
                                  placeholder="••••••••" 
                                  className="pl-10" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full sm:w-auto"
                        disabled={isUpdating}
                      >
                        {isUpdating ? "Updating..." : "Update Password"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              
            </TabsContent>

            <TabsContent value="subscription">
              <Card>
                <CardHeader>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>Review your current plan or move to a lower tier.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-5 rounded-lg border border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="text-xl font-bold">{currentPlanDetails.name}</h3>{currentPlan !== 'free' && <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{currentPlan.toUpperCase()}</span>}</div>
                      <p className="mt-1 text-sm text-gray-600">{currentPlanDetails.price} per month</p>
                    </div>
                    {currentPlan !== 'ultimate' && <Button asChild><Link href="/plans">{currentPlan === 'free' ? 'View upgrade options' : 'Compare plans'}</Link></Button>}
                  </div>

                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold">Included in your plan</h3>
                      <ul className="mt-3 space-y-2">{currentPlanDetails.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-gray-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{feature}</li>)}</ul>
                    </div>
                    <div className="border-t border-gray-200 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      <h3 className="text-sm font-semibold">Change plan</h3>
                      {currentPlan === 'free' ? (
                        <p className="mt-3 text-sm leading-6 text-gray-600">Free is the lowest Tickd tier. Paid upgrades will become available when secure billing is connected.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {planDetails.filter((plan) => plan.id !== currentPlan && (plan.id === 'free' || (currentPlan === 'ultimate' && plan.id === 'pro'))).map((plan) => (
                            <AlertDialog key={plan.id}>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" className="w-full justify-between" disabled={isChangingPlan}>Downgrade to {plan.name}<span className="text-xs text-gray-500">{plan.price}/mo</span></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Downgrade to {plan.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>Your account tier changes immediately. Tracked time and account data will remain in Tickd.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Keep current plan</AlertDialogCancel><AlertDialogAction onClick={() => downgradePlan(plan.id)}>Confirm downgrade</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ))}
                          <p className="text-xs leading-5 text-gray-500">Downgrading changes the account tier immediately. Your tracked data remains in your account.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
