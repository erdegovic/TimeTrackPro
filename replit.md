# replit.md

## Overview

TimeTrackPro is a comprehensive time tracking application designed for freelancers and small businesses. It provides project management, client tracking, time entry management, reporting, and automated invoice generation capabilities. The application features a modern React frontend with a Node.js/Express backend, using PostgreSQL for data persistence and Drizzle ORM for database operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Components**: Shadcn/ui component library with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design tokens and responsive design
- **State Management**: TanStack Query for server state management and React Context for global timer state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Session-based authentication with express-session
- **File Structure**: Modular controller-based architecture with middleware separation
- **API Design**: RESTful APIs with consistent error handling and validation

### Database Design
- **Database**: PostgreSQL with connection pooling via Neon serverless
- **ORM**: Drizzle ORM for type-safe database operations and migrations
- **Schema**: Comprehensive relational schema with foreign key constraints
- **Key Tables**: users, clients, projects, time_entries, invoices, settings, verifications
- **Features**: Email verification system, password reset functionality, and user role management

### Authentication & Security
- **Authentication**: Session-based with secure HTTP-only cookies
- **Password Security**: bcrypt hashing with salt rounds
- **Email Verification**: Token-based email verification for account activation
- **Password Reset**: Secure token-based password reset flow
- **CAPTCHA**: Google reCAPTCHA integration for registration protection

### Timer System
- **Real-time Tracking**: Browser-based timer with localStorage persistence
- **Smart Merging**: Automatic merging of same-day time entries for the same project
- **Context Management**: Global timer state management with React Context
- **Persistence**: Timer state survives page refreshes and browser sessions

### PDF Generation
- **Library**: jsPDF with autoTable plugin for structured document generation
- **Templates**: Multiple invoice templates (professional, modern, classic, minimal)
- **Features**: Detailed time entry reports, client information, and business branding
- **Export**: Direct browser-based PDF generation and download

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **react-hook-form**: Form state management and validation
- **wouter**: Lightweight React routing
- **zod**: Runtime type validation and schema definition

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Modern icon library
- **class-variance-authority**: Utility for component variant management

### Database and Backend
- **@neondatabase/serverless**: PostgreSQL serverless database client
- **drizzle-orm**: Type-safe ORM with migration support
- **express**: Node.js web framework
- **express-session**: Session management middleware

### Authentication and Security
- **bcryptjs**: Password hashing and comparison
- **jsonwebtoken**: JWT token generation and verification (backup auth method)
- **express-session**: Session management with secure cookies

### Email Services
- **@sendgrid/mail**: Email delivery service integration
- **node-fetch**: HTTP client for external API calls
- **Brevo API**: Alternative email service provider (Sendinblue)

### PDF and File Processing
- **jspdf**: Client-side PDF generation
- **jspdf-autotable**: Table generation for PDFs
- **date-fns**: Date manipulation and formatting utilities

### Development and Build Tools
- **vite**: Fast build tool and development server
- **typescript**: Type safety and enhanced development experience
- **drizzle-kit**: Database migration and schema management
- **esbuild**: Fast JavaScript bundler for production builds

### Optional Integrations
- **Google reCAPTCHA**: Bot protection for user registration
- **Anthropic AI SDK**: AI integration capabilities (configured but not actively used)
- **React Google reCAPTCHA**: Client-side CAPTCHA component