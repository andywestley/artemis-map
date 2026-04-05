# Artemis II Mission Tracker (Orion)

A high-fidelity, real-time mission map for the **Artemis II** Orion spacecraft.

![Artemis II Mission Tracker Preview](https://via.placeholder.com/1200x600/02040a/00f2ff?text=Artemis+II+Mission+Tracker)

## 🚀 Key Features

*   **Intercept View Geometry**: A stable mission-aligned frame that fixes the lunar rendezvous point at the top of the screen, showing both Orion and the Moon on an accurate intercept course.
*   **Dynamic Trajectories**: 
    *   **Orion**: Past (solid glow) and Predicted (animated dashed) path with "marching ants" flow.
    *   **Moon**: Animated orbital path showing the Moon's approach to the flyby point.
*   **Real-Time HUD**: Professional glass-morphism dashboard providing altitude, velocity, and distance telemetry.
*   **Multi-Unit Telemetry**: Hover over the Velocity stat to see speed in **km/h**, **mph**, and **m/s**.
*   **Fully Responsive**: optimized for both Desktop and Mobile viewports with adaptive HUD placement.

## 🛠️ Technology Stack

*   **Vite**: Modern frontend tooling for fast development and production builds.
*   **Canvas API**: Custom high-performance rendering for 2D celestial projections.
*   **Bootstrap 5**: Clean, responsive layout components and tooltips.
*   **GitHub Actions**: Automated CI/CD pipeline for instantaneous deployment to GitHub Pages.

## 📦 Getting Started

### Local Development
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

### Production Build
To generate a production-ready static site:
```bash
npm run build
```

## 🛰️ Deployment

This project is configured for automated deployment to your **Private VPS** via GitHub Actions.

### 1. GitHub Secrets Setup
To enable the automated pipeline, you must add the following Secrets to your GitHub repository (**Settings > Secrets and variables > Actions**):

*   `VPS_HOST`: Your server's IP address or domain.
*   `VPS_USERNAME`: The SSH user (e.g., `root` or `deploy`).
*   `VPS_SSH_KEY`: The content of your **private** SSH key (usually found in `~/.ssh/id_ed25519`).
*   `VPS_TARGET_DIR`: The absolute path on your server where the files should be stored (e.g., `/var/www/your-project`).

### 2. Push to Deploy
Once the secrets are set, simply push your changes to the `main` branch. GitHub Actions will:
1.  Initialize the build environment.
2.  Install dependencies and run `npm run build`.
3.  Securely transfer the `dist/` folder to your VPS via SCP.

---
*Developed as part of the Artemis II Visualization Project.*
