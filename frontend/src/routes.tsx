import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './ui/Layout'
import { RequireAuth } from './ui/RequireAuth'
import { HomePage } from './views/HomePage'
import { PortfolioPage } from './views/PortfolioPage'
import { LoginPage } from './views/LoginPage'
import { DashboardPage } from './views/DashboardPage'
import { ProjectsPage } from './views/ProjectsPage'
import { PhotosPage } from './views/PhotosPage'
import { PhotosCollectionPage } from './views/PhotosCollectionPage'
import { SettingsPage } from './views/SettingsPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/photos" element={<PhotosPage />} />
          <Route path="/photos/collection/:kind/:id" element={<PhotosCollectionPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

