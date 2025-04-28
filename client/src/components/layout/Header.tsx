import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  BellIcon, 
  Menu, 
  LogOut, 
  Settings, 
  User, 
  ChevronDown,
  Sun,
  Moon
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title: string;
  userName: string;
  userInitials: string;
  onMobileMenuClick: () => void;
}

export default function Header({ 
  title, 
  userName, 
  userInitials,
  onMobileMenuClick
}: HeaderProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // After mounting, we can access the theme
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };
  
  // Prevent flash of incorrect theme
  if (!mounted) return null;
  
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-neutral-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center">
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-3" 
            onClick={onMobileMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h2 className="text-lg font-medium dark:text-white">{title}</h2>
      </div>
      
      <div className="flex items-center">
        {/* Theme toggle button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="mr-3 h-8 w-8 rounded-full bg-neutral-100 dark:bg-gray-700"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 text-yellow-500" />
          ) : (
            <Moon className="h-5 w-5 text-gray-500" />
          )}
        </Button>
        
        {/* Notification button */}
        <div className="mr-4 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-gray-700"
          >
            <BellIcon className="h-5 w-5 text-neutral-400 dark:text-gray-300" />
          </Button>
          <span className="absolute top-0 right-0 h-2 w-2 bg-secondary rounded-full"></span>
        </div>
        
        {/* User dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full p-1 transition-colors">
              <Avatar className="h-8 w-8 mr-2 bg-primary">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden md:block dark:text-white">{userName}</span>
              <ChevronDown className="ml-1 h-4 w-4 text-gray-500 dark:text-gray-400 hidden md:block" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
