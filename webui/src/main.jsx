import React from "react";
import ReactDOM from "react-dom/client";
import {BrandingProvider} from "@/common/contexts/Branding";
import {AuthProvider} from "@/common/contexts/Auth";
import {createBrowserRouter, Navigate, RouterProvider} from "react-router-dom";
import Root from "@/common/layouts/Root";
import "@fontsource/inter";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";
import "@/common/styles/default.sass";
import Home from "@/pages/Home";
import QuizCreator from "@/pages/QuizCreator";
import Host from "@/pages/Host";
import QuizLoader from "@/pages/QuizLoader";
import {QuizProvider} from "@/common/contexts/Quiz";
import InGameHost from "@/pages/InGameHost";
import EndingHost from "@/pages/EndingHost";
import InGameClient from "@/pages/InGameClient";
import PracticeResults from "@/pages/PracticeResults";
import Admin from "@/pages/Admin";
import Manage from "@/pages/Manage";
import Credits from "@/pages/Credits";

const router = createBrowserRouter([
    {
        path: '/',
        element: <Root/>,
        errorElement: <Navigate to="/"/>,
        children: [
            {path: '/', element: <Home/>},
            {path: '/create', element: <QuizCreator />},
            {path: '/load', element: <QuizLoader />},
            {path: '/host/lobby', element: <Host />},
            {path: '/host/ingame', element: <InGameHost />},
            {path: '/host/ending', element: <EndingHost />},
            {path: '/client', element: <InGameClient />},
            {path: '/practice/:practiceCode', element: <InGameClient />},
            {path: '/results/:code', element: <PracticeResults />},
            {path: '/admin', element: <Admin />},
            {path: '/manage', element: <Manage />},
            {path: '/credits', element: <Credits />}
        ]
    },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrandingProvider>
            <AuthProvider>
                <QuizProvider>
                    <RouterProvider router={router} />
                </QuizProvider>
            </AuthProvider>
        </BrandingProvider>
    </React.StrictMode>,
)
