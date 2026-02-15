"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
    children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [displayChildren, setDisplayChildren] = useState(children);
    const [prevPathname, setPrevPathname] = useState(pathname);

    useEffect(() => {
        if (pathname !== prevPathname) {
            // New route — fade out, swap, fade in
            setIsVisible(false);
            const timeout = setTimeout(() => {
                setDisplayChildren(children);
                setPrevPathname(pathname);
                requestAnimationFrame(() => setIsVisible(true));
            }, 250); // match CSS transition duration
            return () => clearTimeout(timeout);
        } else {
            // Same route, or children updated — just show
            setDisplayChildren(children);
            requestAnimationFrame(() => setIsVisible(true));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, children]);

    return (
        <div
            className="page-transition-wrapper"
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                willChange: "opacity, transform",
                minHeight: "100vh",
            }}
        >
            {displayChildren}
        </div>
    );
}
