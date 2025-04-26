import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BellIcon, Menu } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";

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
        
        <div className="flex items-center">
          <Avatar className="h-8 w-8 mr-2 bg-primary">
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:block">{userName}</span>
        </div>
      </div>
    </header>
  );
}
