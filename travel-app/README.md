# Travel App

A modern travel application built with React, TypeScript, and Material-UI, inspired by Google's design principles. This application helps users explore destinations, plan trips, and manage their travel preferences.

## Features

### Implemented
- Modern, responsive UI with Material-UI components
- User authentication (Login/Register pages)
- Dashboard with personal info and preferences
- Explore page with destination search and featured destinations
- Saved destinations page with the ability to remove saved items
- Settings page with profile, language, and theme options
- Responsive navigation with bottom bar on mobile and side drawer on desktop
- Beautiful animations using Framer Motion
- TypeScript for type safety

### To Be Implemented
- Backend integration
- Real authentication system
- Database for storing user data and preferences
- Actual destination data and search functionality
- Trip planning features
- Real-time weather information
- Travel recommendations
- Social features (sharing trips, following other travelers)
- Offline support
- Push notifications

## Tech Stack

- React 18
- TypeScript
- Material-UI (MUI) v5
- Framer Motion
- Vite
- React Router DOM

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd travel-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5174`

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the production version
- `npm run preview` - Preview the production build
- `npm run lint` - Run the linter

## Project Structure

```
travel-app/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── layouts/       # Layout components
│   ├── App.tsx        # Main application component
│   └── main.tsx       # Application entry point
├── public/            # Static assets
└── package.json       # Project dependencies and scripts
```

## Pages

1. **Login/Register**
   - User authentication forms
   - Form validation
   - Responsive design

2. **Dashboard**
   - Personal information display
   - Travel preferences
   - Trip history
   - Interactive cards with animations

3. **Explore**
   - Search functionality
   - Featured destinations
   - Grid layout with destination cards

4. **Saved**
   - Saved destinations list
   - Delete functionality
   - Card-based layout

5. **Settings**
   - Profile settings
   - Language preferences
   - Theme selection

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
