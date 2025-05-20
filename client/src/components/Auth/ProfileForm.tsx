import { useState, useEffect } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Mail, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

// Form schema
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  user: any;
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailVerificationAlert, setEmailVerificationAlert] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
    },
  });

  // Check for pending email change on component mount
  useEffect(() => {
    if (user?.id) {
      checkPendingEmailChange();
    }
  }, [user?.id]);

  // Function to check if there's a pending email change
  const checkPendingEmailChange = async () => {
    try {
      const response = await fetch('/api/auth/pending-email-change', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pendingEmail) {
          setPendingEmail(data.pendingEmail);
          setEmailVerificationAlert(true);
        }
      }
    } catch (error) {
      console.error('Error checking pending email change:', error);
    }
  };

  // Function to cancel pending email change
  const cancelEmailChange = async () => {
    try {
      const response = await fetch('/api/auth/cancel-email-change', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setPendingEmail(null);
        setEmailVerificationAlert(false);
        toast({
          title: 'Email change canceled',
          description: 'Your pending email change has been canceled.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to cancel email change. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error canceling email change:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  // Submit handler for the profile form
  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Check if email change was requested
        if (result.emailChangeRequested) {
          setPendingEmail(result.pendingEmail);
          setEmailVerificationAlert(true);
          form.setValue('email', user.email); // Reset to current email
          
          toast({
            title: 'Profile updated',
            description: 'Profile updated successfully. Please check your email to verify your new email address.',
          });
        } else {
          toast({
            title: 'Profile updated',
            description: 'Your profile has been updated successfully.',
          });
        }
        
        // Update user in react-query cache
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      } else {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: result.message || 'Failed to update profile',
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {emailVerificationAlert && pendingEmail && (
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <AlertDescription className="flex flex-col space-y-2">
            <p>
              We've sent a verification email to <strong>{pendingEmail}</strong>.
              Please check your inbox and click the verification link to complete your email change.
            </p>
            <div className="flex items-center mt-2">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                onClick={cancelEmailChange}
              >
                Cancel Change
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={checkPendingEmailChange}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Check Status
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="flex items-center">
                    <span className="absolute pl-3 text-gray-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <Input 
                      placeholder="example@email.com" 
                      className="pl-10" 
                      {...field} 
                      disabled={!!pendingEmail}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  {pendingEmail ? (
                    <span className="text-amber-600">
                      Email change pending verification: {pendingEmail}
                    </span>
                  ) : (
                    "Your email address is used for login and notifications."
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button 
            type="submit" 
            className="w-full md:w-auto"
            disabled={isSubmitting || !!pendingEmail}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </form>
      </Form>
    </div>
  );
}