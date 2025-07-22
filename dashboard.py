import tkinter as tk
from tkinter import ttk, messagebox
import os
import pandas as pd
from datetime import datetime
import subprocess
import sys

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

class Dashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Auto Buy Bot Dashboard')
        self.geometry('800x600')
        self.resizable(False, False)
        self.create_widgets()
        self.refresh_order_table()
        self.refresh_bot_status()
        self.last_log_mtime = None
        self.bot_processes = {bot: None for bot in BOT_CONFIG}
        self.auto_refresh_log()

    def create_widgets(self):
        # Top frame: Bot selection and input
        top_frame = ttk.Frame(self)
        top_frame.pack(padx=10, pady=10, fill='x')

        # Row 1: Select Bot, Email, Password
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

        # Row 2: Product URL, Add Order, Run
        ttk.Label(top_frame, text='Product URL:').grid(row=1, column=0, padx=5, pady=5, sticky='w')
        self.url_entry = ttk.Entry(top_frame, width=40)
        self.url_entry.grid(row=1, column=1, columnspan=3, padx=5, pady=5, sticky='we')

        self.add_btn = ttk.Button(top_frame, text='Add Order', command=self.add_order)
        self.add_btn.grid(row=1, column=4, padx=5, pady=5)

        self.run_btn = ttk.Button(top_frame, text='Run', command=self.run_bot)
        self.run_btn.grid(row=1, column=5, padx=5, pady=5)

        # Middle frame: Orders table
        mid_frame = ttk.LabelFrame(self, text='Purchased Orders')
        mid_frame.pack(padx=10, pady=10, fill='both', expand=True)
        columns = ('Timestamp', 'Product', 'Price', 'Status')
        self.order_table = ttk.Treeview(mid_frame, columns=columns, show='headings', height=8)
        for col in columns:
            self.order_table.heading(col, text=col)
            self.order_table.column(col, width=120)
        self.order_table.pack(fill='both', expand=True)

        # Nút xóa log
        self.clear_log_btn = ttk.Button(mid_frame, text='Clear Orders Log', command=self.clear_orders_log)
        self.clear_log_btn.pack(pady=5)

        # Bottom frame: Bot status
        bot_status_frame = ttk.LabelFrame(self, text='Bot Status')
        bot_status_frame.pack(padx=10, pady=10, fill='x')
        self.status_labels = {}
        for idx, bot in enumerate(BOT_CONFIG.keys()):
            lbl = ttk.Label(bot_status_frame, text=f'{bot}: Waiting', foreground='blue')
            lbl.grid(row=0, column=idx, padx=15, pady=5)
            self.status_labels[bot] = lbl

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
                    self.order_table.insert('', tk.END, values=(ts, row.get('Product', ''), row.get('Price', ''), row.get('Status', '')))
            except Exception as e:
                pass

    def refresh_bot_status(self):
        # For demo: all bots are 'Waiting'. You can expand this to read real status from log if needed.
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
                self.status_labels[bot].config(text=f'{bot}: Running', foreground='green')
                self.refresh_order_table()
            except Exception as e:
                messagebox.showerror('Error', f'Failed to run {bat_file}: {e}')

    def auto_refresh_log(self):
        try:
            if os.path.exists(ORDER_LOG_PATH):
                mtime = os.path.getmtime(ORDER_LOG_PATH)
                if self.last_log_mtime != mtime:
                    self.last_log_mtime = mtime
                    self.refresh_order_table()
        except Exception:
            pass
        # Kiểm tra trạng thái bot
        for bot, proc in self.bot_processes.items():
            if proc is not None:
                if proc.poll() is not None:  # Process đã kết thúc
                    self.status_labels[bot].config(text=f'{bot}: Waiting', foreground='blue')
                    self.bot_processes[bot] = None
        self.after(5000, self.auto_refresh_log)  # 5000 ms = 5 giây

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

if __name__ == '__main__':
    app = Dashboard()
    app.mainloop() 