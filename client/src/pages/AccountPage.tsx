import { useState, useRef, useEffect } from 'react';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Lock, User, Mail, Key, Save, Upload } from 'lucide-react';
import { useAuth, UserProfile } from '../hooks/useAuth';
import { queryClient } from '@/lib/queryClient';

// Form schemas
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || 'Alex',
      lastName: user?.lastName || 'Johnson',
      email: user?.email || 'alex.johnson@example.com',
    },
  });
  
  // Load saved profile data from localStorage on component mount
  useEffect(() => {
    if (user) {
      // Use user data from API if available
      profileForm.reset({
        firstName: user.firstName || 'Alex',
        lastName: user.lastName || 'Johnson',
        email: user.email || 'alex.johnson@example.com',
      });
      
      // Use profile image from database if available
      if (user.profileImageUrl) {
        setAvatarUrl(user.profileImageUrl);
      }
    }
  }, [user, profileForm]);
  
  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  
  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Show loading state
      setIsUpdating(true);
      
      // Make sure the file isn't too large
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        setIsUpdating(false);
        return;
      }
      
      // Create a file reader to read the file as a data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        if (result) {
          try {
            // Set the avatar first to give immediate feedback
            setAvatarUrl(result);
            
            // Send to server to save permanently
            const response = await fetch('/api/auth/avatar', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                avatarUrl: result
              }),
            });
            
            if (!response.ok) {
              throw new Error('Failed to update avatar on server');
            }
            
            // Get the response data
            const responseData = await response.json();
            console.log('Avatar upload response:', responseData);
            
            // Force a refresh of the auth data to update profile info
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            
            toast({
              title: "Avatar updated",
              description: "Your profile picture has been updated successfully and saved to the database.",
            });
          } catch (error) {
            console.error('Avatar upload error:', error);
            toast({
              title: "Update failed",
              description: "There was a problem saving your profile picture to the database.",
              variant: "destructive",
            });
          } finally {
            setIsUpdating(false);
          }
        }
      };
      reader.onerror = () => {
        toast({
          title: "Upload failed",
          description: "There was an error reading your image. Please try again.",
          variant: "destructive",
        });
        setIsUpdating(false);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const onProfileSubmit = async (data: ProfileFormValues) => {
    setIsUpdating(true);
    try {
      console.log('Updating profile with:', data);
      
      // Send profile update to server API
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile on server');
      }
      
      const result = await response.json();
      console.log('Profile update response:', result);
      
      // Update UI elements showing the user's name
      const profileNameElements = document.querySelectorAll('.user-profile-name');
      profileNameElements.forEach(element => {
        if (element) {
          element.textContent = `${data.firstName} ${data.lastName}`;
        }
      });
      
      // Handle email verification case specially
      if (result.emailChangeRequested) {
        // Don't update the email field since it requires verification
        toast({
          title: "Profile partially updated",
          description: "Your profile has been updated. Please check your new email address to verify the change.",
        });
        
        // Reset the email field to the current email from the user object
        profileForm.setValue('email', user?.email || '');
      } else {
        // Force a refresh of the profile card data
        const displayName = `${data.firstName} ${data.lastName}`;
        
        // Dispatch a custom event to notify the layout about profile changes
        window.dispatchEvent(new CustomEvent('profile-updated', {}));
        
        // Force a refresh of the auth data
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        
        toast({
          title: "Profile updated",
          description: "Your profile information has been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Update failed",
        description: "There was a problem updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsUpdating(true);
    try {
      // Make a real API call to update the password
      console.log('Updating password with:', data);
      
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update password');
      }
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully and saved to the database.",
      });
      
      // Reset password form
      passwordForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Password update error:', error);
      toast({
        title: "Update failed",
        description: typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : "There was a problem updating your password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your account settings and change your password
        </p>
      </div>
      
      <Separator />
      
      <div className="flex flex-col gap-8 md:flex-row">
        <Card className="md:w-1/3">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>
              This is how others will see you on the site
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Avatar className="h-32 w-32 cursor-pointer rounded-full overflow-hidden" onClick={handleAvatarClick}>
              <AvatarImage src={avatarUrl} alt="User" className="object-cover w-full h-full" />
              <AvatarFallback className="text-lg">
                {user?.firstName?.[0] || 'A'}{user?.lastName?.[0] || 'J'}
              </AvatarFallback>
            </Avatar>
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarChange}
            />
            <div className="text-center">
              <h3 className="text-lg font-medium user-profile-name">
                {user?.firstName || 'Alex'} {user?.lastName || 'Johnson'}
              </h3>
              <p className="text-sm text-gray-500">{user?.email || 'alex.johnson@example.com'}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3" 
                onClick={handleAvatarClick}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-t-transparent" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Change Avatar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex-1">
          <Tabs defaultValue="personal">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">
                <User className="mr-2 h-4 w-4" />
                Personal Info
              </TabsTrigger>
              <TabsTrigger value="password">
                <Lock className="mr-2 h-4 w-4" />
                Password
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="personal" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={profileForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First name</FormLabel>
                              <FormControl>
                                <Input placeholder="First name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last name</FormLabel>
                              <FormControl>
                                <Input placeholder="Last name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <Mail className="mr-2 h-4 w-4 opacity-50 self-center" />
                                <Input placeholder="Email" {...field} />
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
                        {isUpdating ? (
                          <>
                            <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-t-transparent" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save changes
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="password" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
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
                              <div className="flex">
                                <Key className="mr-2 h-4 w-4 opacity-50 self-center" />
                                <Input placeholder="Current password" type="password" {...field} />
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
                              <div className="flex">
                                <Key className="mr-2 h-4 w-4 opacity-50 self-center" />
                                <Input placeholder="New password" type="password" {...field} />
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
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <Key className="mr-2 h-4 w-4 opacity-50 self-center" />
                                <Input placeholder="Confirm new password" type="password" {...field} />
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
                        {isUpdating ? (
                          <>
                            <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-t-transparent" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Change password
                          </>
                        )}
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