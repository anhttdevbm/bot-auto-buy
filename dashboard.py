import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import os
import pandas as pd
from datetime import datetime
import subprocess
import sys
import requests
import json
from threading import Thread
import time

# API Configuration
API_BASE_URL = 'http://localhost:3000/api'
HEADERS = {'Content-Type': 'application/json'}

# Bot config
BOT_CONFIG = {
    'Yodobashi': {
        'excel': 'yodobashi.xlsx',
        'bat': 'start-yodobashi.bat',
    },
    'BicCamera': {
        'excel': 'biccamera.xlsx',
        'bat': 'start-biccamera.bat',
    },
    'PopMart': {
        'excel': 'popMart.xlsx',
        'bat': 'start-popmart.bat',
    },
    'Rakuten': {
        'excel': 'rakuten.xlsx',
        'bat': 'start-rakuten.bat',
    },
}

ORDER_LOG_PATH = os.path.join('data', 'order_log.xlsx')

class AuthManager:
    def __init__(self):
        self.token = None
        self.user = None
        self.refresh_token = None
    
    def set_credentials(self, token, refresh_token, user):
        self.token = token
        self.refresh_token = refresh_token
        self.user = user
    
    def get_headers(self):
        headers = HEADERS.copy()
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    def clear_credentials(self):
        self.token = None
        self.refresh_token = None
        self.user = None

class LoginDialog:
    def __init__(self, parent):
        self.parent = parent
        self.result = None
        self.create_dialog()
    
    def create_dialog(self):
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title('Auto Buy Bot - Login')
        self.dialog.geometry('400x250')
        self.dialog.resizable(False, False)
        self.dialog.grab_set()
        
        # Center the dialog
        self.dialog.transient(self.parent)
        self.center_window()
        
        # Main frame
        main_frame = ttk.Frame(self.dialog, padding="20")
        main_frame.pack(fill='both', expand=True)
        
        # Title
        title_label = ttk.Label(main_frame, text='Login to Auto Buy Bot', font=('Arial', 16, 'bold'))
        title_label.pack(pady=(0, 20))
        
        # Email
        ttk.Label(main_frame, text='Email:').pack(anchor='w')
        self.email_entry = ttk.Entry(main_frame, width=40)
        self.email_entry.pack(fill='x', pady=(5, 10))
        self.email_entry.insert(0, 'admin@autobuybot.com')  # Default admin email
        
        # Password
        ttk.Label(main_frame, text='Password:').pack(anchor='w')
        self.password_entry = ttk.Entry(main_frame, width=40, show='*')
        self.password_entry.pack(fill='x', pady=(5, 20))
        self.password_entry.insert(0, 'admin123')  # Default admin password
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill='x')
        
        ttk.Button(button_frame, text='Cancel', command=self.cancel).pack(side='right', padx=(10, 0))
        ttk.Button(button_frame, text='Login', command=self.login).pack(side='right')
        
        # Bind Enter key
        self.dialog.bind('<Return>', lambda e: self.login())
        self.email_entry.focus()
    
    def center_window(self):
        self.dialog.update_idletasks()
        x = (self.dialog.winfo_screenwidth() // 2) - (self.dialog.winfo_width() // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (self.dialog.winfo_height() // 2)
        self.dialog.geometry(f'+{x}+{y}')
    
    def login(self):
        email = self.email_entry.get().strip()
        password = self.password_entry.get().strip()
        
        if not email or not password:
            messagebox.showerror('Error', 'Please enter both email and password')
            return
        
        try:
            response = requests.post(f'{API_BASE_URL}/auth/login', 
                                   json={'email': email, 'password': password},
                                   headers=HEADERS,
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.result = {
                        'token': data['data']['accessToken'],
                        'refresh_token': data['data']['refreshToken'],
                        'user': data['data']['user']
                    }
                    self.dialog.destroy()
                else:
                    messagebox.showerror('Login Failed', data.get('message', 'Unknown error'))
            else:
                data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                messagebox.showerror('Login Failed', data.get('message', f'HTTP {response.status_code}'))
                
        except requests.exceptions.RequestException as e:
            messagebox.showerror('Connection Error', 
                               'Cannot connect to API server. Please make sure the server is running.\n\n'
                               'To start the server, run: npm start')
        except Exception as e:
            messagebox.showerror('Error', f'Login failed: {str(e)}')
    
    def cancel(self):
        self.dialog.destroy()

class UserManagementDialog:
    def __init__(self, parent, auth_manager):
        self.parent = parent
        self.auth_manager = auth_manager
        self.users = []
        self.create_dialog()
        self.load_users()
    
    def create_dialog(self):
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title('User Management')
        self.dialog.geometry('900x600')
        self.dialog.resizable(True, True)
        self.dialog.grab_set()
        
        main_frame = ttk.Frame(self.dialog, padding="10")
        main_frame.pack(fill='both', expand=True)
        
        title_label = ttk.Label(main_frame, text='User Management', font=('Arial', 16, 'bold'))
        title_label.pack(pady=(0, 10))
        
        toolbar_frame = ttk.Frame(main_frame)
        toolbar_frame.pack(fill='x', pady=(0, 10))
        
        ttk.Button(toolbar_frame, text='Add User', command=self.add_user).pack(side='left', padx=(0, 5))
        ttk.Button(toolbar_frame, text='Edit User', command=self.edit_user).pack(side='left', padx=(0, 5))
        ttk.Button(toolbar_frame, text='Delete User', command=self.delete_user).pack(side='left', padx=(0, 5))
        ttk.Button(toolbar_frame, text='Reset Password', command=self.reset_password).pack(side='left', padx=(0, 5))
        ttk.Button(toolbar_frame, text='Refresh', command=self.load_users).pack(side='left', padx=(10, 0))
        
        columns = ('ID', 'Email', 'Role', 'First Name', 'Last Name', 'Status', 'Created At')
        self.user_tree = ttk.Treeview(main_frame, columns=columns, show='headings', height=15)
        
        self.user_tree.heading('ID', text='ID')
        self.user_tree.heading('Email', text='Email')
        self.user_tree.heading('Role', text='Role')
        self.user_tree.heading('First Name', text='First Name')
        self.user_tree.heading('Last Name', text='Last Name')
        self.user_tree.heading('Status', text='Status')
        self.user_tree.heading('Created At', text='Created At')
        
        self.user_tree.column('ID', width=50)
        self.user_tree.column('Email', width=200)
        self.user_tree.column('Role', width=80)
        self.user_tree.column('First Name', width=100)
        self.user_tree.column('Last Name', width=100)
        self.user_tree.column('Status', width=80)
        self.user_tree.column('Created At', width=150)
        
        scrollbar = ttk.Scrollbar(main_frame, orient='vertical', command=self.user_tree.yview)
        self.user_tree.configure(yscrollcommand=scrollbar.set)
        
        self.user_tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        ttk.Button(main_frame, text='Close', command=self.dialog.destroy).pack(pady=(10, 0))
    
    def load_users(self):
        try:
            response = requests.get(f'{API_BASE_URL}/users', 
                                  headers=self.auth_manager.get_headers(),
                                  timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.users = data['data']['users']
                    self.refresh_table()
                else:
                    messagebox.showerror('Error', data.get('message', 'Failed to load users'))
            else:
                messagebox.showerror('Error', f'HTTP {response.status_code}')
                
        except Exception as e:
            messagebox.showerror('Error', f'Failed to load users: {str(e)}')
    
    def refresh_table(self):
        for item in self.user_tree.get_children():
            self.user_tree.delete(item)
    
        for user in self.users:
            status = 'Active' if user.get('is_active', True) else 'Inactive'
            created_at = user.get('created_at', '')
            if created_at:
                try:
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
                except:
                    pass
            
            self.user_tree.insert('', 'end', values=(
                user.get('id', ''),
                user.get('email', ''),
                user.get('role', ''),
                user.get('first_name', ''),
                user.get('last_name', ''),
                status,
                created_at
            ))
    
    def get_selected_user(self):
        selection = self.user_tree.selection()
        if not selection:
            messagebox.showwarning('Warning', 'Please select a user')
            return None
        
        item = self.user_tree.item(selection[0])
        user_id = item['values'][0]
        return next((user for user in self.users if user['id'] == user_id), None)
    
    def add_user(self):
        dialog = UserDialog(self.dialog, self.auth_manager, None)
        if dialog.result:
            self.load_users()
    
    def edit_user(self):
        user = self.get_selected_user()
        if user:
            dialog = UserDialog(self.dialog, self.auth_manager, user)
            if dialog.result:
                self.load_users()
    
    def delete_user(self):
        user = self.get_selected_user()
        if not user:
            return
        
        if messagebox.askyesno('Confirm Delete', f'Are you sure you want to delete user "{user["email"]}"?'):
            try:
                response = requests.delete(f'{API_BASE_URL}/users/{user["id"]}',
                                         headers=self.auth_manager.get_headers(),
                                         timeout=10)
                
                if response.status_code == 200:
                    messagebox.showinfo('Success', 'User deleted successfully')
                    self.load_users()
                else:
                    data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                    messagebox.showerror('Error', data.get('message', f'HTTP {response.status_code}'))
                    
            except Exception as e:
                messagebox.showerror('Error', f'Failed to delete user: {str(e)}')
    
    def reset_password(self):
        user = self.get_selected_user()
        if not user:
            return
        
        new_password = simpledialog.askstring('Reset Password', 
                                             f'Enter new password for {user["email"]}:',
                                             show='*')
        if new_password:
            try:
                response = requests.post(f'{API_BASE_URL}/users/{user["id"]}/reset-password',
                                       json={'newPassword': new_password},
                                       headers=self.auth_manager.get_headers(),
                                       timeout=10)
                
                if response.status_code == 200:
                    messagebox.showinfo('Success', 'Password reset successfully')
                else:
                    data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                    messagebox.showerror('Error', data.get('message', f'HTTP {response.status_code}'))
                    
            except Exception as e:
                messagebox.showerror('Error', f'Failed to reset password: {str(e)}')

class UserDialog:
    def __init__(self, parent, auth_manager, user=None):
        self.parent = parent
        self.auth_manager = auth_manager
        self.user = user
        self.result = None
        self.create_dialog()
    
    def create_dialog(self):
        self.dialog = tk.Toplevel(self.parent)
        title = 'Edit User' if self.user else 'Add User'
        self.dialog.title(title)
        self.dialog.geometry('450x500')
        self.dialog.resizable(True, True)
        self.dialog.grab_set()
        
        self.dialog.transient(self.parent)
        self.center_window()
        
        main_frame = ttk.Frame(self.dialog, padding="20")
        main_frame.pack(fill='both', expand=True)
        
        title_label = ttk.Label(main_frame, text=title, font=('Arial', 16, 'bold'))
        title_label.pack(pady=(0, 20))
        
        ttk.Label(main_frame, text='Email:').pack(anchor='w')
        self.email_entry = ttk.Entry(main_frame, width=40)
        self.email_entry.pack(fill='x', pady=(5, 10))
        
        if not self.user:
            ttk.Label(main_frame, text='Password:').pack(anchor='w')
            self.password_entry = ttk.Entry(main_frame, width=40, show='*')
            self.password_entry.pack(fill='x', pady=(5, 10))
        
        ttk.Label(main_frame, text='Role:').pack(anchor='w')
        self.role_var = tk.StringVar()
        role_combo = ttk.Combobox(main_frame, textvariable=self.role_var, 
                                 values=['admin', 'staff', 'viewer'], state='readonly')
        role_combo.pack(fill='x', pady=(5, 10))
        
        ttk.Label(main_frame, text='First Name:').pack(anchor='w')
        self.first_name_entry = ttk.Entry(main_frame, width=40)
        self.first_name_entry.pack(fill='x', pady=(5, 10))
        
        ttk.Label(main_frame, text='Last Name:').pack(anchor='w')
        self.last_name_entry = ttk.Entry(main_frame, width=40)
        self.last_name_entry.pack(fill='x', pady=(5, 10))
        
        if self.user:
            self.is_active_var = tk.BooleanVar()
            ttk.Checkbutton(main_frame, text='Active', variable=self.is_active_var).pack(anchor='w', pady=(5, 10))
        
        if self.user:
            self.email_entry.insert(0, self.user.get('email', ''))
            self.role_var.set(self.user.get('role', ''))
            self.first_name_entry.insert(0, self.user.get('first_name', ''))
            self.last_name_entry.insert(0, self.user.get('last_name', ''))
            self.is_active_var.set(self.user.get('is_active', True))
        else:
            self.role_var.set('viewer')
        
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill='x', pady=(20, 0))
        
        ttk.Button(button_frame, text='Cancel', command=self.cancel).pack(side='right', padx=(10, 0))
        ttk.Button(button_frame, text='Save', command=self.save).pack(side='right')
    
    def save(self):
        email = self.email_entry.get().strip()
        first_name = self.first_name_entry.get().strip()
        last_name = self.last_name_entry.get().strip()
        role = self.role_var.get()
        
        if not email:
            messagebox.showerror('Error', 'Email is required')
            return
        
        data = {
            'email': email,
            'role': role,
            'first_name': first_name,
            'last_name': last_name
        }
        
        if not self.user:
            # Adding new user
            password = self.password_entry.get().strip()
            if not password:
                messagebox.showerror('Error', 'Password is required')
                return
            data['password'] = password
            
            try:
                response = requests.post(f'{API_BASE_URL}/users',
                                       json=data,
                                       headers=self.auth_manager.get_headers(),
                                       timeout=10)
                
                if response.status_code == 201:
                    messagebox.showinfo('Success', 'User created successfully')
                    self.result = True
                    self.dialog.destroy()
                else:
                    response_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                    messagebox.showerror('Error', response_data.get('message', f'HTTP {response.status_code}'))
                    
            except Exception as e:
                messagebox.showerror('Error', f'Failed to create user: {str(e)}')
        else:
            data['is_active'] = self.is_active_var.get()
            
            try:
                response = requests.put(f'{API_BASE_URL}/users/{self.user["id"]}',
                                      json=data,
                                      headers=self.auth_manager.get_headers(),
                                      timeout=10)
                
                if response.status_code == 200:
                    messagebox.showinfo('Success', 'User updated successfully')
                    self.result = True
                    self.dialog.destroy()
                else:
                    response_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                    messagebox.showerror('Error', response_data.get('message', f'HTTP {response.status_code}'))
                    
            except Exception as e:
                messagebox.showerror('Error', f'Failed to update user: {str(e)}')
    
    def center_window(self):
        self.dialog.update_idletasks()
        x = (self.dialog.winfo_screenwidth() // 2) - (self.dialog.winfo_width() // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (self.dialog.winfo_height() // 2)
        self.dialog.geometry(f'+{x}+{y}')
    
    def cancel(self):
        self.dialog.destroy()

class Dashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.auth_manager = AuthManager()
        self.title('Auto Buy Bot Dashboard')
        self.geometry('1000x700')
        self.resizable(True, True)

        self.api_mode = self.check_api_server()
        
        if self.api_mode:
            if not self.login():
                self.destroy()
                return
        
        self.create_widgets()
        self.refresh_data()
        self.last_log_mtime = None
        self.bot_processes = {bot: None for bot in BOT_CONFIG}
        self.auto_refresh()
    
    def check_api_server(self):
        try:
            response = requests.get(f'{API_BASE_URL}/../health', timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def login(self):
        login_dialog = LoginDialog(self)
        self.wait_window(login_dialog.dialog)
        
        if login_dialog.result:
            self.auth_manager.set_credentials(
                login_dialog.result['token'],
                login_dialog.result['refresh_token'],
                login_dialog.result['user']
            )
            return True
        return False

    def create_widgets(self):
        menubar = tk.Menu(self)
        self.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='File', menu=file_menu)
        if self.api_mode:
            file_menu.add_command(label='Logout', command=self.logout)
            file_menu.add_separator()
        file_menu.add_command(label='Exit', command=self.quit)
        
        if self.api_mode and self.auth_manager.user and self.auth_manager.user.get('role') == 'admin':
            admin_menu = tk.Menu(menubar, tearoff=0)
            menubar.add_cascade(label='Admin', menu=admin_menu)
            admin_menu.add_command(label='User Management', command=self.open_user_management)
        
        main_frame = ttk.Frame(self, padding="10")
        main_frame.pack(fill='both', expand=True)
        
        if self.api_mode and self.auth_manager.user:
            user_frame = ttk.LabelFrame(main_frame, text='User Information', padding="10")
            user_frame.pack(fill='x', pady=(0, 10))
            
            user = self.auth_manager.user
            ttk.Label(user_frame, text=f"Welcome, {user.get('first_name', '')} {user.get('last_name', '')} ({user.get('email', '')})").pack(anchor='w')
            ttk.Label(user_frame, text=f"Role: {user.get('role', '').title()}").pack(anchor='w')
        
        if not self.api_mode or self.can_run_bots():
            bot_frame = ttk.LabelFrame(main_frame, text='Bot Control', padding="10")
            bot_frame.pack(fill='x', pady=(0, 10))
            
            top_frame = ttk.Frame(bot_frame)
            top_frame.pack(padx=10, pady=10, fill='x')

            ttk.Label(top_frame, text='Select Bot:').grid(row=0, column=0, padx=5, pady=5, sticky='w')
            self.bot_var = tk.StringVar(value='Yodobashi')
            self.bot_combo = ttk.Combobox(top_frame, textvariable=self.bot_var, values=list(BOT_CONFIG.keys()), state='readonly', width=12)
            self.bot_combo.grid(row=0, column=1, padx=5, pady=5)

            ttk.Label(top_frame, text='Email:').grid(row=0, column=2, padx=5, pady=5, sticky='w')
            self.email_entry = ttk.Entry(top_frame, width=20)
            self.email_entry.grid(row=0, column=3, padx=5, pady=5)

            ttk.Label(top_frame, text='Password:').grid(row=0, column=4, padx=5, pady=5, sticky='w')
            self.password_entry = ttk.Entry(top_frame, width=15, show='*')
            self.password_entry.grid(row=0, column=5, padx=5, pady=5)

            ttk.Label(top_frame, text='Product URL:').grid(row=1, column=0, padx=5, pady=5, sticky='w')
            self.url_entry = ttk.Entry(top_frame, width=40)
            self.url_entry.grid(row=1, column=1, columnspan=3, padx=5, pady=5, sticky='we')

            self.add_btn = ttk.Button(top_frame, text='Add Order', command=self.add_order)
            self.add_btn.grid(row=1, column=4, padx=5, pady=5)

            self.run_btn = ttk.Button(top_frame, text='Run', command=self.run_bot)
            self.run_btn.grid(row=1, column=5, padx=5, pady=5)
            
            if self.api_mode:
                api_controls = ttk.Frame(bot_frame)
                api_controls.pack(fill='x', pady=(10, 0))
                
                ttk.Button(api_controls, text='Start Bot (API)', command=self.start_bot).pack(side='left', padx=(0, 5))
                ttk.Button(api_controls, text='Stop Bot (API)', command=self.stop_bot).pack(side='left', padx=(0, 5))
                
                if self.auth_manager.user and self.auth_manager.user.get('role') in ['admin']:
                    ttk.Button(api_controls, text='Stop All Bots', command=self.stop_all_bots).pack(side='left', padx=(10, 0))
        
        status_frame = ttk.LabelFrame(main_frame, text='Bot Status', padding="10")
        status_frame.pack(fill='x', pady=(0, 10))
        
        self.status_labels = {}
        if self.api_mode:
            bot_names = ['yodobashi', 'biccamera', 'popmart', 'rakuten']
        else:
            bot_names = list(BOT_CONFIG.keys())
            
        for idx, bot in enumerate(bot_names):
            display_name = bot.title() if self.api_mode else bot
            lbl = ttk.Label(status_frame, text=f'{display_name}: Loading...', foreground='gray')
            lbl.grid(row=0, column=idx, padx=15, pady=5)
            self.status_labels[bot] = lbl

        mid_frame = ttk.LabelFrame(main_frame, text='Purchased Orders')
        mid_frame.pack(padx=10, pady=10, fill='both', expand=True)
        
        columns = ('Timestamp', 'Platform', 'Product', 'Price', 'Status')
        self.order_table = ttk.Treeview(mid_frame, columns=columns, show='headings', height=8)
        for col in columns:
            self.order_table.heading(col, text=col)
            self.order_table.column(col, width=120)
        
        order_scrollbar = ttk.Scrollbar(mid_frame, orient='vertical', command=self.order_table.yview)
        self.order_table.configure(yscrollcommand=order_scrollbar.set)
        
        self.order_table.pack(side='left', fill='both', expand=True)
        order_scrollbar.pack(side='right', fill='y')

        button_frame = ttk.Frame(mid_frame)
        button_frame.pack(pady=5, fill='x')
        
        self.clear_log_btn = ttk.Button(button_frame, text='Clear Orders Log', command=self.clear_orders_log)
        self.clear_log_btn.pack(side='left', padx=(0, 5))
        
        ttk.Button(button_frame, text='Refresh', command=self.refresh_data).pack(side='left')

    def can_run_bots(self):
        if not self.api_mode:
            return True
        role = self.auth_manager.user.get('role') if self.auth_manager.user else None
        return role in ['admin', 'staff']
    
    def open_user_management(self):
        UserManagementDialog(self, self.auth_manager)
    
    def logout(self):
        try:
            requests.post(f'{API_BASE_URL}/auth/logout', 
                         headers=self.auth_manager.get_headers(), 
                         timeout=5)
        except:
            pass
        
        self.auth_manager.clear_credentials()
        messagebox.showinfo('Logout', 'Logged out successfully')
        self.destroy()
    
    def start_bot(self):
        if not self.can_run_bots():
            messagebox.showerror('Permission Denied', 'You do not have permission to run bots')
            return
        
        bot_type = self.bot_var.get().lower()
        try:
            response = requests.post(f'{API_BASE_URL}/bots/{bot_type}/start',
                                   headers=self.auth_manager.get_headers(),
                                   timeout=10)
            
            if response.status_code == 200:
                messagebox.showinfo('Success', f'{bot_type.title()} bot started successfully')
                self.refresh_bot_status()
            else:
                data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                messagebox.showerror('Error', data.get('message', f'HTTP {response.status_code}'))
                
        except Exception as e:
            messagebox.showerror('Error', f'Failed to start bot: {str(e)}')
    
    def stop_bot(self):
        if not self.can_run_bots():
            messagebox.showerror('Permission Denied', 'You do not have permission to stop bots')
            return
        
        bot_type = self.bot_var.get().lower()
        try:
            response = requests.post(f'{API_BASE_URL}/bots/{bot_type}/stop',
                                   headers=self.auth_manager.get_headers(),
                                   timeout=10)
            
            if response.status_code == 200:
                messagebox.showinfo('Success', f'{bot_type.title()} bot stopped successfully')
                self.refresh_bot_status()
            else:
                data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                messagebox.showerror('Error', data.get('message', f'HTTP {response.status_code}'))
                
        except Exception as e:
            messagebox.showerror('Error', f'Failed to stop bot: {str(e)}')
    
    def stop_all_bots(self):
        if not self.auth_manager.user or self.auth_manager.user.get('role') != 'admin':
            messagebox.showerror('Permission Denied', 'Only administrators can stop all bots')
            return
        
        if messagebox.askyesno('Confirm', 'Are you sure you want to stop all bots?'):
            try:
                response = requests.post(f'{API_BASE_URL}/bots/stop-all',
                                       headers=self.auth_manager.get_headers(),
                                       timeout=10)
                
                if response.status_code == 200:
                    messagebox.showinfo('Success', 'All bots stopped successfully')
                    self.refresh_bot_status()
                else:
                    data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                    messagebox.showerror('Error', data.get('message', f'HTTP {response.status_code}'))
                    
            except Exception as e:
                messagebox.showerror('Error', f'Failed to stop all bots: {str(e)}')

    def add_order(self):
        bot = self.bot_var.get()
        email = self.email_entry.get().strip()
        password = self.password_entry.get().strip()
        url = self.url_entry.get().strip()
        excel_path = BOT_CONFIG[bot]['excel']
        if not (email and password and url):
            messagebox.showwarning('Input Error', 'Please fill all fields.')
            return
        # Write to Excel (append or create)
        row = {'Email': email, 'Password': password, 'URL': url}
        if os.path.exists(excel_path):
            df = pd.read_excel(excel_path)
            df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        else:
            df = pd.DataFrame([row])
        df.to_excel(excel_path, index=False)
        messagebox.showinfo('Success', f'Order added to {excel_path}')
        self.email_entry.delete(0, tk.END)
        self.password_entry.delete(0, tk.END)
        self.url_entry.delete(0, tk.END)
        self.refresh_order_table()

    def refresh_order_table(self):
        # Clear table
        for row in self.order_table.get_children():
            self.order_table.delete(row)
        # Load order log
        if os.path.exists(ORDER_LOG_PATH):
            try:
                df = pd.read_excel(ORDER_LOG_PATH)
                for _, row in df.iterrows():
                    ts = row.get('Timestamp', '')
                    # Format timestamp nếu có
                    if pd.notnull(ts):
                        try:
                            ts = pd.to_datetime(ts)
                            ts = ts.strftime('%Y-%m-%d %H:%M:%S')
                        except Exception:
                            ts = str(ts)
                    self.order_table.insert('', tk.END, values=(
                        ts, 
                        row.get('Platform', 'Unknown'),
                        row.get('Product', ''), 
                        row.get('Price', ''), 
                        row.get('Status', '')
                    ))
            except Exception as e:
                pass

    def refresh_bot_status(self):
        if self.api_mode:
            try:
                response = requests.get(f'{API_BASE_URL}/bots/status',
                                      headers=self.auth_manager.get_headers(),
                                      timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        status_data = data['data']['status']
                        for bot_type, status in status_data.items():
                            if bot_type in self.status_labels:
                                if status['running']:
                                    self.status_labels[bot_type].config(
                                        text=f'{bot_type.title()}: Running (PID: {status.get("pid", "N/A")})', 
                                        foreground='green'
                                    )
                                else:
                                    self.status_labels[bot_type].config(
                                        text=f'{bot_type.title()}: Stopped', 
                                        foreground='red'
                                    )
                                    
            except Exception as e:
                for bot_type in self.status_labels:
                    self.status_labels[bot_type].config(
                        text=f'{bot_type.title()}: Unknown', 
                        foreground='orange'
                    )
        else:
            for bot, lbl in self.status_labels.items():
                lbl.config(text=f'{bot}: Waiting', foreground='blue')

    def run_bot(self):
        bot = self.bot_var.get()
        bat_file = BOT_CONFIG[bot]['bat']
        if not os.path.exists(bat_file):
            messagebox.showerror('Error', f'Batch file not found: {bat_file}')
            return
        confirm = messagebox.askyesno('Confirm', f'Run {bat_file}?')
        if confirm:
            try:
                if sys.platform == "win32":
                    proc = subprocess.Popen([bat_file], shell=True, creationflags=subprocess.CREATE_NO_WINDOW)
                else:
                    proc = subprocess.Popen(['sh', bat_file])
                self.bot_processes[bot] = proc
                if bot.lower() in self.status_labels:
                    self.status_labels[bot.lower()].config(text=f'{bot}: Running', foreground='green')
                elif bot in self.status_labels:
                    self.status_labels[bot].config(text=f'{bot}: Running', foreground='green')
                self.refresh_order_table()
            except Exception as e:
                messagebox.showerror('Error', f'Failed to run {bat_file}: {e}')

    def auto_refresh(self):
        try:
            if os.path.exists(ORDER_LOG_PATH):
                mtime = os.path.getmtime(ORDER_LOG_PATH)
                if self.last_log_mtime != mtime:
                    self.last_log_mtime = mtime
                    self.refresh_order_table()
        except Exception:
            pass
        
        if not self.api_mode:
            for bot, proc in self.bot_processes.items():
                if proc is not None:
                    if proc.poll() is not None:  # Process đã kết thúc
                        if bot.lower() in self.status_labels:
                            self.status_labels[bot.lower()].config(text=f'{bot}: Waiting', foreground='blue')
                        elif bot in self.status_labels:
                            self.status_labels[bot].config(text=f'{bot}: Waiting', foreground='blue')
                        self.bot_processes[bot] = None
        else:
            self.refresh_bot_status()
            
        refresh_interval = 30000 if self.api_mode else 5000
        self.after(refresh_interval, self.auto_refresh)

    def clear_orders_log(self):
        if not os.path.exists(ORDER_LOG_PATH):
            messagebox.showinfo('Info', 'No orders log to clear.')
            return
        confirm = messagebox.askyesno('Confirm', 'Are you sure you want to delete all purchased orders log?')
        if confirm:
            try:
                os.remove(ORDER_LOG_PATH)
                self.refresh_order_table()
                messagebox.showinfo('Success', 'Orders log cleared.')
            except Exception as e:
                messagebox.showerror('Error', f'Failed to clear orders log: {e}')
    
    def refresh_data(self):
        self.refresh_bot_status()
        self.refresh_order_table()

if __name__ == '__main__':
    app = Dashboard()
    if app.winfo_exists():
        app.mainloop()