import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette, FileText, Zap, Eye, Settings as SettingsIcon, Upload, X } from "lucide-react";

const settingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  businessWebsite: z.string().url("Invalid URL").optional().or(z.literal("")),
  businessLogo: z.string().optional(),
  invoiceTemplate: z.string().default("luxury"),
  invoiceColorTheme: z.string().default("#3b82f6"),
  invoiceBackgroundColor: z.string().default("#ffffff"),
  invoiceTextColor: z.string().default("#000000"),
  showLogo: z.boolean().default(true),
  showCompanyDetails: z.boolean().default(true),
  customFontSize: z.number().min(8).max(20).default(14),
  invoiceFooterText: z.string().optional(),
  displayCurrency: z.string().default("$"),
  nextInvoiceNumber: z.string().optional(),
  timeFormat: z.enum(["12", "24"]).default("12"),
  defaultHourlyRate: z.number().min(0).default(50),
  autoStartTimer: z.boolean().default(false),
  enableNotifications: z.boolean().default(true),
  reminderFrequency: z.enum(["never", "daily", "weekly"]).default("weekly"),
  defaultProjectColor: z.string().default("#3b82f6"),
  enableTimeTracking: z.boolean().default(true),
  enableProjectManagement: z.boolean().default(true),
  enableInvoicing: z.boolean().default(true),
  enableReporting: z.boolean().default(true),
  backupFrequency: z.enum(["never", "daily", "weekly", "monthly"]).default("weekly"),
  exportFormat: z.enum(["pdf", "csv", "xlsx"]).default("pdf"),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPageFixed() {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: "",
      businessAddress: "",
      businessPhone: "",
      businessEmail: "",
      businessWebsite: "",
      businessLogo: "",
      invoiceTemplate: "luxury",
      invoiceColorTheme: "#3b82f6",
      invoiceBackgroundColor: "#ffffff",
      invoiceTextColor: "#000000",
      showLogo: true,
      showCompanyDetails: true,
      customFontSize: 14,
      invoiceFooterText: "",
      displayCurrency: "$",
      nextInvoiceNumber: "1001",
      timeFormat: "12",
      defaultHourlyRate: 50,
      autoStartTimer: false,
      enableNotifications: true,
      reminderFrequency: "weekly",
      defaultProjectColor: "#3b82f6",
      enableTimeTracking: true,
      enableProjectManagement: true,
      enableInvoicing: true,
      enableReporting: true,
      backupFrequency: "weekly",
      exportFormat: "pdf",
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
        <div className="text-center">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="business" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="business" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
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
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '2rem',
                            padding: '2rem 2.5rem',
                            background: '#f9f9f9'
                          }}>
                            <div>
                              <h3 style={{
                                color: '#e50914',
                                marginBottom: '1rem',
                                fontSize: '1.1rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                margin: '0 0 1rem 0'
                              }}>
                                Bill To
                              </h3>
                              <p style={{ marginBottom: '0.5rem', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>DREAMWAVE PRODUCTIONS</p>
                              <p style={{ marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>456 Media District</p>
                              <p style={{ marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>Los Angeles, CA 90028</p>
                              <p style={{ marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>contact@dreamwave.tv</p>
                            </div>
                            <div>
                              <h3 style={{
                                color: '#e50914',
                                marginBottom: '1rem',
                                fontSize: '1.1rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                margin: '0 0 1rem 0'
                              }}>
                                Project Details
                              </h3>
                              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Project:</strong> "Midnight Sessions" Music Video</p>
                              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Project ID:</strong> PRJ-MV-2024-003</p>
                              <p style={{ margin: '0 0 0.5rem 0' }}><strong>Shoot Dates:</strong> Oct 15-17, 2024</p>
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
                                  borderBottom: '2px solid #e0e0e0',
                                  width: '50%'
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
                              <tr>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  Camera Equipment Rental
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
                                  {watchedValues.displayCurrency}400.00
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  {watchedValues.displayCurrency}1,200.00
                                </td>
                              </tr>
                              <tr>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  Post-Production & Color Grading
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  5
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  {watchedValues.displayCurrency}125.00
                                </td>
                                <td style={{
                                  padding: '1rem',
                                  borderBottom: '1px solid #e0e0e0'
                                }}>
                                  {watchedValues.displayCurrency}625.00
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
                              marginBottom: '0.8rem'
                            }}>
                              <span>Subtotal:</span>
                              <span>{watchedValues.displayCurrency}4,375.00</span>
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontWeight: '700',
                              color: '#e50914',
                              fontSize: '1.2rem',
                              marginTop: '1rem',
                              paddingTop: '1rem',
                              borderTop: '2px dashed #e0e0e0'
                            }}>
                              <span>TOTAL DUE:</span>
                              <span>{watchedValues.displayCurrency}4,375.00</span>
                            </div>
                          </div>

                          <div style={{
                            padding: '0 2.5rem 2rem',
                            color: '#666',
                            fontSize: '0.9rem'
                          }}>
                            <p style={{ margin: '0 0 0.5rem 0' }}>
                              <strong style={{ color: '#1a1a1a' }}>Payment Terms:</strong> Net 30. Late fees of 1.5% monthly apply after due date.
                            </p>
                            <p style={{ margin: '0 0 0.5rem 0' }}>
                              <strong style={{ color: '#1a1a1a' }}>Payment Methods:</strong> Bank transfer, check, or credit card (+3% processing fee).
                            </p>
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
                              Let's create something extraordinary together.
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

            {/* Other tabs content would go here */}
          </Tabs>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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