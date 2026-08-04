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
import { Lock, User, Key, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import ProfileForm from '@/components/Auth/ProfileForm';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

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
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // In a real app, you would upload the file to a server
    // For now, just use a local URL
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        // Set avatar locally
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
          });
          
          if (response.ok) {
            toast({
              title: 'Avatar updated',
              description: 'Your profile picture has been updated successfully',
            });
            
            // Update user in react-query cache
            queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          } else {
            toast({
              variant: 'destructive',
              title: 'Update failed',
              description: 'Failed to update avatar',
            });
          }
        } catch (error) {
          console.error('Error updating avatar:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'An unexpected error occurred',
          });
        }
      }
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
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 cursor-pointer" onClick={handleAvatarClick}>
                    <AvatarImage src={user?.profileImageUrl || avatarUrl} alt="Profile" />
                    <AvatarFallback className="bg-gray-100">
                      <User className="h-10 w-10 text-gray-400" />
                    </AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground" 
                    onClick={handleAvatarClick}
                    title="Upload profile picture"
                    aria-label="Upload profile picture"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
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
          <Tabs defaultValue="profile">
            <TabsList className="mb-4 w-full grid grid-cols-2">
              <TabsTrigger value="profile" className="flex items-center text-xs sm:text-sm">
                <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Profile</span>
                <span className="sm:hidden">Info</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center text-xs sm:text-sm">
                <Lock className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Security
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
