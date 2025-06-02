import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Loader2, Save, Upload, X, Palette, Eye, FileText, Building,
  ChevronRight, ChevronDown, Zap, BrushIcon, Type, CreditCard 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const settingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  businessAddress: z.string().optional(),
  businessCity: z.string().optional(),
  businessState: z.string().optional(),
  businessZipCode: z.string().optional(),
  businessCountry: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  businessTaxId: z.string().optional(),
  
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankSortCode: z.string().optional(),
  
  nextInvoiceNumber: z.coerce.number().int().positive("Must be a positive number"),
  defaultTimeFormat: z.enum(["decimal", "time"]),
  defaultCurrency: z.string().min(1, "Currency is required"),
  displayCurrency: z.string().min(1, "Display currency is required"),
  enableTax: z.boolean().default(false),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
  
  businessLogo: z.string().optional(),
  
  invoiceTemplate: z.string().default("luxury"),
  invoiceColorTheme: z.string().default("#3b82f6"),
  invoiceBackgroundColor: z.string().default("#ffffff"),
  invoiceTextColor: z.string().default("#1f2937"),
  customFontSize: z.coerce.number().min(8).max(20).default(14),
  showLogo: z.boolean().default(true),
  showCompanyDetails: z.boolean().default(true),
  invoiceFooterText: z.string().optional(),
  
  defaultProjectColor: z.string().default("#3b82f6"),
  reminderFrequency: z.enum(["never", "daily", "weekly", "monthly"]).default("weekly"),
  enableEmailReminders: z.boolean().default(false),
  emailReminderDays: z.coerce.number().min(1).max(30).default(7),
  enableOverdueNotifications: z.boolean().default(false),
  
  userTimezone: z.string().default("UTC"),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD/MM/YYYY"),
  timeFormat: z.enum(["12", "24"]).default("12"),
  weekStartDay: z.enum(["monday", "sunday"]).default("monday"),
  fiscalYearStart: z.enum(["january", "april", "july", "october"]).default("january"),
  
  enableTimeTracking: z.boolean().default(true),
  enableProjectManagement: z.boolean().default(true),
  enableInvoicing: z.boolean().default(true),
  enableReporting: z.boolean().default(true),
  allowGuestAccess: z.boolean().default(false),
  
  autoBackup: z.boolean().default(false),
  backupFrequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  enableApiAccess: z.boolean().default(false),
  apiRateLimit: z.coerce.number().min(100).max(10000).default(1000)
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["business", "invoice"]));

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "",
      businessAddress: "",
      businessCity: "",
      businessState: "",
      businessZipCode: "",
      businessCountry: "",
      businessPhone: "",
      businessEmail: "",
      businessTaxId: "",
      
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankSortCode: "",
      
      nextInvoiceNumber: 1001,
      defaultTimeFormat: "decimal",
      defaultCurrency: "USD",
      displayCurrency: "$",
      enableTax: false,
      defaultTaxRate: 0,
      
      businessLogo: "",
      
      invoiceTemplate: "luxury",
      invoiceColorTheme: "#3b82f6",
      invoiceBackgroundColor: "#ffffff",
      invoiceTextColor: "#1f2937",
      customFontSize: 14,
      showLogo: true,
      showCompanyDetails: true,
      invoiceFooterText: "",
      
      defaultProjectColor: "#3b82f6",
      reminderFrequency: "weekly",
      enableEmailReminders: false,
      emailReminderDays: 7,
      enableOverdueNotifications: false,
      
      userTimezone: "UTC",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12",
      weekStartDay: "monday",
      fiscalYearStart: "january",
      
      enableTimeTracking: true,
      enableProjectManagement: true,
      enableInvoicing: true,
      enableReporting: true,
      allowGuestAccess: false,
      
      autoBackup: false,
      backupFrequency: "weekly",
      enableApiAccess: false,
      apiRateLimit: 1000
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings);
      if (settings.businessLogo) {
        setLogoPreview(settings.businessLogo);
      }
    }
  }, [settings, form]);

  const watchedValues = form.watch();

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("PUT", "/api/settings", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const isSubmitting = updateSettingsMutation.isPending;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Building className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="business" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="business" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Business
              </TabsTrigger>
              <TabsTrigger value="customization" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Invoice Design
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Features
              </TabsTrigger>
            </TabsList>

            {/* Business Tab */}
            <TabsContent value="business" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Business Information</CardTitle>
                  <CardDescription>
                    Configure your business details for invoices and client communications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Business Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="123 Business Street, City, State 12345" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="businessEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="contact@yourbusiness.com" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="businessPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoice Design Tab */}
            <TabsContent value="customization" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Template</CardTitle>
                  <CardDescription>
                    Choose from professional invoice templates designed for different industries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="invoiceTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="video-production">Video Production</SelectItem>
                            <SelectItem value="luxury">Luxury</SelectItem>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="coding">Coding</SelectItem>
                            <SelectItem value="graphic-design">Graphic Design</SelectItem>
                            <SelectItem value="accounting">Accounting</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="hr-recruitment">HR & Recruitment</SelectItem>
                            <SelectItem value="engineering">Engineering</SelectItem>
                            <SelectItem value="health-wellness">Health & Wellness</SelectItem>
                            <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                            <SelectItem value="minimalist">Minimalist</SelectItem>
                            <SelectItem value="classic">Classic</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Preview</CardTitle>
                  <CardDescription>
                    See how your customizations will look on actual invoices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className="max-w-3xl mx-auto overflow-hidden bg-white shadow-lg"
                    style={{ 
                      fontSize: `${watchedValues.customFontSize}px`
                    }}
                  >
                    {/* Video Production Template */}
                    {watchedValues.invoiceTemplate === 'video-production' && (
                      <div style={{
                        fontFamily: "'Helvetica Neue', Arial, sans-serif",
                        backgroundColor: '#f5f5f5',
                        color: '#333',
                        lineHeight: '1.6',
                        position: 'relative',
                        margin: '-2rem',
                        padding: '2rem'
                      }}>
                        <div style={{
                          maxWidth: '800px',
                          margin: '0 auto',
                          background: 'white',
                          boxShadow: '0 5px 30px rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '8px',
                            background: 'linear-gradient(90deg, #e50914, #ff4757)'
                          }}></div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '2.5rem',
                            borderBottom: '1px solid #e0e0e0'
                          }}>
                            <div>
                              <h1 style={{
                                fontSize: '2rem',
                                color: '#1a1a1a',
                                marginBottom: '0.5rem',
                                fontWeight: '700',
                                margin: 0
                              }}>
                                {watchedValues.businessName || "LUMINA FILMS"}
                              </h1>
                              <p style={{
                                color: '#666',
                                fontSize: '0.95rem',
                                margin: '0 0 0.25rem 0'
                              }}>
                                {watchedValues.businessAddress || "123 Creative Studios Blvd"}
                              </p>
                              <p style={{
                                color: '#666',
                                fontSize: '0.95rem',
                                margin: 0
                              }}>
                                {watchedValues.businessEmail || "hello@luminafilms.com"} | {watchedValues.businessPhone || "(555) 123-FILM"}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                fontSize: '1.3rem',
                                color: '#e50914',
                                marginBottom: '0.5rem',
                                fontWeight: '600'
                              }}>
                                INV #{watchedValues.nextInvoiceNumber || "2024-001"}
                              </div>
                              <div style={{
                                color: '#666',
                                fontSize: '0.9rem'
                              }}>
                                <div>Date: {new Date().toLocaleDateString()}</div>
                                <div>Due: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </div>

                          <div style={{
                            height: '20px',
                            background: 'repeating-linear-gradient(90deg, #1a1a1a, #1a1a1a 10px, transparent 10px, transparent 30px)',
                            margin: '0 2.5rem',
                            position: 'relative'
                          }}>
                            <div style={{
                              position: 'absolute',
                              left: '-20px',
                              top: 0,
                              width: '20px',
                              height: '100%',
                              background: '#1a1a1a',
                              borderRadius: '10px 0 0 10px'
                            }}></div>
                            <div style={{
                              position: 'absolute',
                              right: '-20px',
                              top: 0,
                              width: '20px',
                              height: '100%',
                              background: '#1a1a1a',
                              borderRadius: '0 10px 10px 0'
                            }}></div>
                          </div>

                          <table style={{
                            width: 'calc(100% - 5rem)',
                            margin: '2rem 2.5rem',
                            borderCollapse: 'collapse'
                          }}>
                            <thead>
                              <tr>
                                <th style={{
                                  textAlign: 'left',
                                  padding: '1rem',
                                  background: '#f9f9f9',
                                  color: '#1a1a1a',
                                  fontWeight: '600',
                                  borderBottom: '2px solid #e0e0e0'
                                }}>
                                  Description
                                </th>
                                <th style={{
                                  textAlign: 'left',
                                  padding: '1rem',
                                  background: '#f9f9f9',
                                  color: '#1a1a1a',
                                  fontWeight: '600',
                                  borderBottom: '2px solid #e0e0e0'
                                }}>
                                  Days
                                </th>
                                <th style={{
                                  textAlign: 'left',
                                  padding: '1rem',
                                  background: '#f9f9f9',
                                  color: '#1a1a1a',
                                  fontWeight: '600',
                                  borderBottom: '2px solid #e0e0e0'
                                }}>
                                  Rate
                                </th>
                                <th style={{
                                  textAlign: 'left',
                                  padding: '1rem',
                                  background: '#f9f9f9',
                                  color: '#1a1a1a',
                                  fontWeight: '600',
                                  borderBottom: '2px solid #e0e0e0'
                                }}>
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  Director of Photography
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  3
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  {watchedValues.displayCurrency}850.00
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  {watchedValues.displayCurrency}2,550.00
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          <div style={{
                            margin: '2rem 2.5rem',
                            paddingTop: '1rem',
                            borderTop: '2px dashed #e0e0e0'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontWeight: '700',
                              color: '#e50914',
                              fontSize: '1.2rem'
                            }}>
                              <span>TOTAL DUE:</span>
                              <span>{watchedValues.displayCurrency}2,550.00</span>
                            </div>
                          </div>

                          <div style={{
                            padding: '2rem 2.5rem',
                            background: '#f9f9f9',
                            textAlign: 'center',
                            color: '#666',
                            fontSize: '0.9rem'
                          }}>
                            <p style={{ margin: 0 }}>
                              Thank you for choosing <strong>{watchedValues.businessName || "LUMINA FILMS"}!</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Default preview for other templates */}
                    {watchedValues.invoiceTemplate !== 'video-production' && (
                      <div className="p-8 bg-white">
                        <div className="text-center mb-6">
                          <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
                          <p className="text-gray-600">Invoice #{watchedValues.nextInvoiceNumber || "1001"}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8 mb-8">
                          <div>
                            <h3 className="font-semibold mb-2">From:</h3>
                            <p className="font-bold">{watchedValues.businessName || "Your Business Name"}</p>
                            <p className="text-sm text-gray-600">{watchedValues.businessAddress || "Your Business Address"}</p>
                            <p className="text-sm text-gray-600">{watchedValues.businessEmail || "your@email.com"}</p>
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">To:</h3>
                            <p className="font-bold">Sample Client</p>
                            <p className="text-sm text-gray-600">123 Client Street</p>
                            <p className="text-sm text-gray-600">client@example.com</p>
                          </div>
                        </div>

                        <table className="w-full border-collapse mb-6">
                          <thead>
                            <tr className="border-b-2">
                              <th className="text-left p-2">Description</th>
                              <th className="text-left p-2">Hours</th>
                              <th className="text-left p-2">Rate</th>
                              <th className="text-left p-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2">Sample Service</td>
                              <td className="p-2">10</td>
                              <td className="p-2">{watchedValues.displayCurrency}75.00</td>
                              <td className="p-2">{watchedValues.displayCurrency}750.00</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="text-right">
                          <p className="text-xl font-bold">Total: {watchedValues.displayCurrency}750.00</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Feature Toggles</CardTitle>
                  <CardDescription>
                    Enable or disable application features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enableTimeTracking"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Time Tracking</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enableInvoicing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Invoicing</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}