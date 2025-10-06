# Fahrtenbuch Pro

**Fahrtenbuch Pro** is a professional web application designed to fully automate the process of recording and declaring professional mileage for Austrian tax purposes (Finanzamt). It transforms manual processing of callsheets and schedules into a smart, centralized digital workflow.

## Features

- 📊 **Trip Management**: Record and manage all your business trips
- 📁 **Project Organization**: Organize trips by projects with callsheet uploads
- 🗺️ **Google Maps Integration**: Automatic distance calculation and route optimization
- 📅 **Google Calendar Sync**: Import trips from your calendar
- 📈 **Advanced Analytics**: CO2 tracking, statistics, and custom reports
- 🔐 **Secure Cloud Storage**: Data stored securely in Supabase
- 🔄 **Trip Ledger**: Immutable ledger system for audit compliance
- 🎨 **Modern UI**: Beautiful and intuitive interface

## Prerequisites

- Node.js (v18 or higher)
- Supabase account
- Google Maps API key (optional, for distance calculation)
- Google Calendar OAuth credentials (optional, for calendar sync)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your API keys and credentials
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for required environment variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key
- `VITE_GOOGLE_CALENDAR_CLIENT_ID`: Google Calendar OAuth client ID
- `VITE_OPENROUTER_API_KEY`: OpenRouter API key for AI features
- `GEMINI_API_KEY`: Gemini API key for AI features

## Build for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

## Preview Production Build

```bash
npm run preview
```

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Database**: Supabase (PostgreSQL)
- **UI**: Tailwind CSS + Lucide React Icons
- **Charts**: Recharts
- **AI**: Google Gemini + OpenRouter

## License

Private - All rights reserved
