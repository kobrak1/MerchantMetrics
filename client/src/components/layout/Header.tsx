import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BellIcon,
  Menu,
  LogOut,
  Settings,
  User,
  ChevronDown,
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
  onMobileMenuClick,
}: HeaderProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white border-b-[2px] border-primary px-4 py-2 h-[61px] flex items-center justify-between shadow-lg shadow-primary/20">
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
        {/* User dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center cursor-pointer hover:bg-gray-50 rounded-full p-1 mr-4 transition-colors">
              <Avatar className="h-8 w-8 mr-2 bg-primary">
                <AvatarFallback className="text-neutral-200">
                  {userInitials}{" "}
                </AvatarFallback>
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
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
