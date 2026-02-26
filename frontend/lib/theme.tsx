"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "light",
    toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("verifair-theme") as Theme) || "light";
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);
    const mounted = useRef(false);

    const applyTheme = (t: Theme) => {
        document.documentElement.setAttribute("data-theme", t);
        if (t === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    };

    // Apply theme on mount (no setState needed since initial state is already correct)
    useEffect(() => {
        applyTheme(theme);
        mounted.current = true;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem("verifair-theme", next);
        applyTheme(next);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
