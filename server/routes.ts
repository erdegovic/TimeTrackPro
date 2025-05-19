import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertClientSchema, 
  insertProjectSchema, 
  insertTimeEntrySchema, 
  insertInvoiceSchema, 
  insertSettingsSchema,
  timeFormatEnum,
  roundingTypeEnum,
  timeEntries
} from "@shared/schema";
import { z } from "zod";
import { addDays, format } from "date-fns";
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // All API routes use /api prefix
  
  // Clients API
  app.get("/api/clients", async (req: Request, res: Response) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req: Request, res: Response) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const clientData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(id, clientData);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteClient(id);
      
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Projects API
  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      
      if (clientId) {
        const projects = await storage.getProjectsByClient(clientId);
        return res.json(projects);
      }
      
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(id, projectData);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProject(id);
      
      if (!success) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Time Entries API
  app.get("/api/time-entries", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      if (projectId) {
        const entries = await storage.getTimeEntriesByProject(projectId);
        return res.json(entries);
      }
      
      if (startDate && endDate) {
        const entries = await storage.getTimeEntriesByDateRange(startDate, endDate);
        return res.json(entries);
      }
      
      const entries = await storage.getTimeEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.get("/api/time-entries/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getTimeEntry(id);
      
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch time entry" });
    }
  });

  app.post("/api/time-entries", async (req: Request, res: Response) => {
    try {
      const entryData = insertTimeEntrySchema.parse(req.body);
      const entry = await storage.createTimeEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid time entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create time entry" });
    }
  });
  
  // Add a special endpoint for the time tracker to handle string dates
  app.post("/api/tracker/time-entries", async (req: Request, res: Response) => {
    try {
      console.log("Received time entry from tracker:", req.body);
      
      // Extract the data from the request
      const { 
        description, 
        projectId, 
        startTime: startTimeStr, 
        endTime: endTimeStr, 
        duration,
        date,
        month,
        year,
        weekNumber,
        weekLabel,
        billable 
      } = req.body;
      
      // Validate required fields
      if (!description || !projectId || !startTimeStr || !endTimeStr || !date) {
        return res.status(400).json({ 
          message: "Missing required fields", 
          required: ["description", "projectId", "startTime", "endTime", "date"] 
        });
      }
      
      // Convert string dates to Date objects
      const startTime = new Date(startTimeStr);
      const endTime = new Date(endTimeStr);
      
      // If client provided a duration, use it; otherwise calculate it
      let finalDuration;
      if (duration) {
        // Trust the client's calculation if it's provided
        finalDuration = duration;
        console.log(`Using client-provided duration: ${finalDuration} hours`);
      } else {
        // Calculate it on the server as a fallback
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        // For very short durations, ensure we don't round to zero
        let hoursDecimal = diffHours;
        if (hoursDecimal > 0 && hoursDecimal < 0.01) {
          hoursDecimal = 0.01; // Minimum of 0.01 hours (36 seconds)
        }
        finalDuration = hoursDecimal.toFixed(2);
        console.log(`Calculated duration from time difference: ${finalDuration} hours`);
      }
      
      // Create the time entry with converted dates
      const entry = await storage.createTimeEntry({
        description,
        projectId: Number(projectId),
        startTime,
        endTime,
        duration: finalDuration,
        date,
        month,
        year: Number(year),
        weekNumber: Number(weekNumber),
        weekLabel,
        billable: Boolean(billable)
      });
      
      // Debug the entry creation
      console.log("Time entry created:", JSON.stringify(entry));
      
      // Double-check to make sure the entry was saved
      const savedEntry = await storage.getTimeEntry(entry.id);
      console.log("Verified entry in database:", JSON.stringify(savedEntry));
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating time entry from tracker:", error);
      res.status(500).json({ 
        message: "Failed to create time entry", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.put("/api/time-entries/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const entryData = insertTimeEntrySchema.partial().parse(req.body);
      const entry = await storage.updateTimeEntry(id, entryData);
      
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid time entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTimeEntry(id);
      
      if (!success) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete time entry" });
    }
  });

  // Reports API
  app.post("/api/reports", async (req: Request, res: Response) => {
    try {
      const reportSchema = z.object({
        clientId: z.number().optional(),
        projectId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        timeFormat: z.enum(["decimal", "time"]),
        roundingType: z.enum(["none", "nearest_tenth", "nearest_quarter", "nearest_half"]),
        timeAdjustment: z.object({
          increaseByPercentage: z.boolean(),
          percentage: z.number(),
          roundToNearestTenth: z.boolean()
        }).optional()
      });
      
      const reportFilters = reportSchema.parse(req.body);
      const timeEntries = await storage.getTimeEntriesByFilters(reportFilters);
      
      // Get related projects and clients for the report
      const projects = await storage.getProjects();
      const clients = await storage.getClients();
      
      // Enhance time entries with project and client data
      const entriesWithDetails = await Promise.all(
        timeEntries.map(async (entry) => {
          const project = projects.find(p => p.id === entry.projectId);
          const client = project ? clients.find(c => c.id === project.clientId) : undefined;
          
          // Use client's currency for the amount calculation
          let hourlyRate = project?.hourlyRate || "0";
          let duration = typeof entry.duration === 'number' ? entry.duration : parseFloat(entry.duration || "0");
          let amount = (parseFloat(hourlyRate) * duration).toFixed(2);
          
          return {
            ...entry,
            project,
            client,
            hourlyRate,
            amount,
            // Include client currency to ensure it's available for formatting
            currency: client?.currency || 'USD'
          };
        })
      );
      
      // Group entries by week
      const entriesByWeek = entriesWithDetails.reduce((acc, entry) => {
        const weekKey = `${entry.year}-${entry.weekNumber}`;
        if (!acc[weekKey]) {
          acc[weekKey] = {
            weekNumber: entry.weekNumber,
            weekLabel: entry.weekLabel,
            entries: [],
            totalHours: 0,
            totalAmount: 0
          };
        }
        
        acc[weekKey].entries.push(entry);
        acc[weekKey].totalHours += Number(entry.duration);
        acc[weekKey].totalAmount += Number(entry.amount);
        
        return acc;
      }, {} as Record<string, any>);
      
      // Calculate totals
      const totalHours = entriesWithDetails.reduce((sum, entry) => sum + Number(entry.duration), 0);
      const totalAmount = entriesWithDetails.reduce((sum, entry) => sum + Number(entry.amount), 0);
      
      res.json({
        timeEntries: entriesWithDetails,
        weeklyData: Object.values(entriesByWeek),
        totalHours,
        totalAmount,
        timeFormat: reportFilters.timeFormat,
        roundingType: reportFilters.roundingType,
        timeAdjustment: reportFilters.timeAdjustment
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid report filters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Invoices API
  app.get("/api/invoices", async (req: Request, res: Response) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/number/:number", async (req: Request, res: Response) => {
    try {
      const invoiceNumber = req.params.number;
      const invoice = await storage.getInvoiceByNumber(invoiceNumber);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", async (req: Request, res: Response) => {
    try {
      // Get the next invoice number
      const nextInvoiceNumber = await storage.getNextInvoiceNumber();
      
      // Get business settings for default due date
      const settings = await storage.getSettings();
      const issueDate = format(new Date(), 'yyyy-MM-dd');
      const dueDate = format(addDays(new Date(), 15), 'yyyy-MM-dd'); // Default to 15 days
      
      // Process data to ensure types match schema
      const data = {...req.body};
      
      // Ensure taxRate is a string
      if (data.taxRate && typeof data.taxRate !== 'string') {
        data.taxRate = String(data.taxRate);
      }
      
      // Extract additionalItems from the request if present and remove it from data
      const additionalItems = data.additionalItems;
      delete data.additionalItems;
      
      // Prepare invoice data with only the fields expected by the schema
      const invoiceData = insertInvoiceSchema.parse({
        clientId: data.clientId,
        invoiceNumber: nextInvoiceNumber,
        issueDate,
        dueDate,
        subtotal: data.subtotal,
        tax: data.tax,
        taxRate: data.taxRate,
        total: data.amount,
        status: data.status || 'draft',
        notes: data.notes || '',
        currency: data.currency || 'USD'
      });
      
      const invoice = await storage.createInvoice(invoiceData);
      
      // Mark related time entries as invoiced
      if (req.body.timeEntryIds && Array.isArray(req.body.timeEntryIds)) {
        console.log("Marking time entries as invoiced:", req.body.timeEntryIds);
        
        for (const entryId of req.body.timeEntryIds) {
          try {
            const entry = await storage.getTimeEntry(parseInt(entryId));
            if (entry) {
              // Use direct database update since the schema doesn't include invoiceId in the type
              await db
                .update(timeEntries)
                .set({ invoiceId: invoice.id })
                .where(eq(timeEntries.id, entry.id));
                
              console.log(`Updated time entry ${entry.id} with invoice ID ${invoice.id}`);
            }
          } catch (err) {
            console.error(`Error updating time entry ${entryId}:`, err);
          }
        }
      }
      
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(id, invoiceData);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteInvoice(id);
      
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Get next invoice number
  app.get("/api/next-invoice-number", async (req: Request, res: Response) => {
    try {
      const nextInvoiceNumber = await storage.getNextInvoiceNumber();
      res.json({ invoiceNumber: nextInvoiceNumber });
    } catch (error) {
      res.status(500).json({ message: "Failed to get next invoice number" });
    }
  });

  // Settings API
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      console.log("Fetched settings:", JSON.stringify(settings));
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/settings", async (req: Request, res: Response) => {
    try {
      console.log("Updating settings with data:", JSON.stringify(req.body));
      
      // Process data to ensure types match schema
      const data = req.body;
      
      // Convert nextInvoiceNumber to number if it's a string
      if (data.nextInvoiceNumber && typeof data.nextInvoiceNumber === 'string') {
        data.nextInvoiceNumber = parseInt(data.nextInvoiceNumber, 10);
      }
      
      // Ensure defaultTaxRate is a string
      if (data.defaultTaxRate && typeof data.defaultTaxRate !== 'string') {
        data.defaultTaxRate = String(data.defaultTaxRate);
      }
      
      console.log("Processed settings data:", JSON.stringify(data));
      const settingsData = insertSettingsSchema.partial().parse(data);
      
      const settings = await storage.updateSettings(settingsData);
      console.log("Settings updated successfully:", JSON.stringify(settings));
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid settings data", 
          errors: error.errors,
          details: "Make sure defaultTaxRate is a string and nextInvoiceNumber is a number" 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to update settings", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
