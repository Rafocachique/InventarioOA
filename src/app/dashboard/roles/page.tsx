
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, auth } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, deleteUser, signInWithCredential, EmailAuthProvider, signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";


interface User {
  id: string; // This will now be the Firebase Auth UID
  name: string;
  email: string;
  role: string;
}

export default function RolesPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [managingUser, setManagingUser] = React.useState<User | null>(null);

  const [newUserName, setNewUserName] = React.useState("");
  const [newUserEmail, setNewUserEmail] = React.useState("");
  const [newUserPassword, setNewUserPassword] = React.useState("");
  const [newUserRole, setNewUserRole] = React.useState("Supervisor");

  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los usuarios.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({
        variant: "destructive",
        title: "Campos Incompletos",
        description: "Por favor, complete todos los campos.",
      });
      return;
    }

    const adminUser = auth.currentUser;
    if (!adminUser || !adminUser.email) {
      toast({ variant: "destructive", title: "Error de Administrador", description: "No se pudo verificar la sesión del administrador." });
      return;
    }
    const adminEmail = adminUser.email;
    const adminPassword = prompt("Para confirmar, por favor ingrese su contraseña de administrador:");

    if (!adminPassword) {
      toast({ variant: "destructive", title: "Operación Cancelada", description: "Se requiere la contraseña del administrador." });
      return;
    }
    
    try {
      // Step 1: Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);
      const newUser = userCredential.user;

      // Step 2: Store user role and name in Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
      });

      toast({
        title: "Usuario Creado",
        description: "El nuevo usuario ha sido añadido con éxito.",
      });
      
      // Step 3: Re-authenticate the admin to keep their session active
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      
      // Reset form and close dialog
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("Supervisor");
      setIsAddUserOpen(false);
      fetchUsers(); // Refresh users list

    } catch (error: any) {
      console.error("Error creating user: ", error);
      
      let description = "No se pudo crear el usuario.";
      if (error.code === 'auth/email-already-in-use') {
        description = "El correo electrónico ya está en uso por otra cuenta.";
      } else if (error.code === 'auth/weak-password') {
        description = "La contraseña debe tener al menos 6 caracteres.";
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "La contraseña de administrador es incorrecta. No se creó el usuario.";
      }

      // If user creation succeeded but re-login failed, the admin is logged out.
      // We should inform them about this.
      if (auth.currentUser?.email !== adminEmail) {
          description += " Se ha cerrado la sesión de administrador."
      }

      toast({
        variant: "destructive",
        title: "Error de Creación",
        description: description,
      });
    }
  };
  
  const handleSaveRole = async (newRole: string) => {
    if (!managingUser || !newRole) return;

    try {
        const userDocRef = doc(db, "users", managingUser.id);
        await updateDoc(userDocRef, {
            role: newRole
        });
        toast({
            title: "Rol Actualizado",
            description: `El rol de ${managingUser.name} ha sido actualizado.`,
        });
        setManagingUser(null);
        fetchUsers();
    } catch (error) {
        console.error("Error updating role: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo actualizar el rol.",
        });
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
      try {
          // This is a privileged operation and would typically be handled by a backend function
          // For this app, we'll just show a message.
          
          await deleteDoc(doc(db, "users", userToDelete.id));

          toast({
              title: "Usuario Eliminado de Firestore",
              description: `Se eliminó a ${userToDelete.name} de la lista. Para completar la eliminación, borre el usuario de Firebase Authentication.`,
          });
          
          fetchUsers();
      } catch (error) {
          console.error("Error deleting user: ", error);
          toast({
              variant: "destructive",
              title: "Error",
              description: "No se pudo eliminar el usuario de Firestore. La eliminación de la autenticación debe hacerse por separado.",
          });
      }
  }


  return (
    <>
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gestión de Roles y Usuarios</h1>
          <Button onClick={() => setIsAddUserOpen(true)} size="sm" className="h-8 gap-1" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Añadir Usuario</span>
          </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            Administra los usuarios del sistema y sus roles asignados. Los datos se guardan en Firebase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'Administrador' ? 'default' : 'secondary'}>{user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setManagingUser(user)}>
                            Cambiar Rol
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-500" onSelect={() => handleDeleteUser(user)}>Eliminar Usuario</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Añadir Nuevo Usuario</DialogTitle>
                <DialogDescription>Complete los datos para crear un nuevo usuario.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="new-name">Nombre Completo</Label>
                    <Input id="new-name" placeholder="Ej: Carlos Ruiz" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="new-email">Email</Label>
                    <Input id="new-email" type="email" placeholder="ejemplo@dominio.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="new-password">Contraseña</Label>
                    <Input id="new-password" type="password" placeholder="••••••••" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="new-role">Rol</Label>
                    <Select onValueChange={setNewUserRole} defaultValue={newUserRole}>
                        <SelectTrigger id="new-role">
                            <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Administrador">Administrador</SelectItem>
                            <SelectItem value="Supervisor">Supervisor</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateUser}>Crear Usuario</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manage Role Dialog */}
      {managingUser && (
        <Dialog open={!!managingUser} onOpenChange={() => setManagingUser(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gestionar Rol de {managingUser.name}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <p>Email: <span className="font-semibold">{managingUser.email}</span></p>
                    <div className="space-y-2">
                        <Label htmlFor="manage-role">Rol Actual</Label>
                        <Select defaultValue={managingUser.role} onValueChange={(value) => setManagingUser({...managingUser, role: value})}>
                            <SelectTrigger id="manage-role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Supervisor">Supervisor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setManagingUser(null)}>Cancelar</Button>
                    <Button onClick={() => handleSaveRole(managingUser.role)}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </>
  );
}
