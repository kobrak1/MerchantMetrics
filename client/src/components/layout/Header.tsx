import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  BellIcon, 
  Menu, 
  LogOut, 
  Settings, 
  User, 
  ChevronDown 
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
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
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  return (
    <header className="bg-white border-b border-neutral-200 px-4 py-2 flex items-center justify-between">
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
        <h2 className="text-lg font-medium">{title}</h2>
      </div>
      
      <div className="flex items-center">
        <div className="mr-4 relative">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-neutral-100">
            <BellIcon className="h-5 w-5 text-neutral-400" />
          </Button>
          <span className="absolute top-0 right-0 h-2 w-2 bg-secondary rounded-full"></span>
        </div>
        
        {/* User dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center cursor-pointer hover:bg-gray-50 rounded-full p-1 transition-colors">
              <Avatar className="h-8 w-8 mr-2 bg-primary">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden md:block">{userName}</span>
              <ChevronDown className="ml-1 h-4 w-4 text-gray-500 hidden md:block" />
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
